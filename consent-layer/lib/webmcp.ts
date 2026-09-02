import {
  EVIDENCE_SOURCES,
  ELIGIBILITY_REQUIREMENTS,
  FIELD_ORDER,
  type ActivityEvent,
  type ApplicationState,
  type FieldId,
  type TransitionResult,
  getMissingFields,
  getSubmissionPreview,
  requestSubmissionAuthorization,
  setApplicationFieldByAgent,
  submitApplication,
} from "./application.ts";

export interface WebMcpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute: (
    input: Record<string, unknown>,
    options?: { signal: AbortSignal },
  ) => Promise<unknown> | unknown;
}

export interface ModelContextLike {
  registerTool: (
    tool: WebMcpTool,
    options?: { signal?: AbortSignal; exposedTo?: string[] },
  ) => Promise<undefined>;
}

export interface ConsentToolContext {
  getState: () => ApplicationState;
  applyTransition: (
    transition: (state: ApplicationState) => TransitionResult,
  ) => TransitionResult["result"];
  record: (event: Omit<ActivityEvent, "id">) => void;
}

const emptySchema = { type: "object", properties: {}, additionalProperties: false };

const fieldIdSchema = {
  type: "string",
  enum: FIELD_ORDER,
  description: "The stable identifier of an application field.",
};

function isFieldId(value: unknown): value is FieldId {
  return typeof value === "string" && FIELD_ORDER.includes(value as FieldId);
}

function invalidField() {
  return {
    ok: false,
    code: "INVALID_FIELD",
    message: `fieldId must be one of: ${FIELD_ORDER.join(", ")}.`,
  };
}

export function buildConsentTools(context: ConsentToolContext): WebMcpTool[] {
  return [
    {
      name: "inspect_application",
      title: "Inspect application",
      description:
        "Read the scholarship application structure, current answers, statuses, and authority boundary. This tool does not modify the application.",
      inputSchema: emptySchema,
      annotations: { readOnlyHint: true },
      execute: () => {
        const state = context.getState();
        context.record({
          type: "READ",
          title: "Inspected current application",
          detail: "Read field values, provenance states, and completion status.",
          evidence: "No changes made",
        });
        return {
          ok: true,
          application: {
            title: "Future Builders Scholarship",
            status: state.submitted ? "submitted" : "in_progress",
            fields: FIELD_ORDER.map((id) => {
              const field = state.fields[id];
              return {
                id: field.id,
                label: field.label,
                value: field.value || null,
                status: field.status,
                authority: field.authority,
              };
            }),
            preview: getSubmissionPreview(state),
          },
        };
      },
    },
    {
      name: "inspect_eligibility",
      title: "Inspect eligibility",
      description:
        "Read the published eligibility requirements and the evidence-backed eligibility assessment. This tool does not modify the application.",
      inputSchema: emptySchema,
      annotations: { readOnlyHint: true },
      execute: () => {
        context.record({
          type: "READ",
          title: "Re-checked eligibility",
          detail: "All five criteria remain supported by available evidence.",
          evidence: "Eligible · 5 of 5",
        });
        return {
          ok: true,
          eligible: true,
          requirements: ELIGIBILITY_REQUIREMENTS.map((requirement) => ({
            requirement,
            status: "supported",
          })),
        };
      },
    },
    {
      name: "inspect_available_evidence",
      title: "Inspect evidence",
      description:
        "List the evidence sources available for drafting. Household income is intentionally absent and must not be inferred.",
      inputSchema: emptySchema,
      annotations: { readOnlyHint: true },
      execute: () => {
        context.record({
          type: "READ",
          title: "Inspected available evidence",
          detail: "Verified three sources; none contains household income.",
          evidence: "3 verified · 1 known gap",
        });
        return {
          ok: true,
          evidence: EVIDENCE_SOURCES,
          explicitlyUnavailable: ["householdIncome"],
          instruction:
            "Do not infer household income. Ask the human to provide it directly.",
        };
      },
    },
    {
      name: "get_missing_information",
      title: "Find missing information",
      description:
        "Return required fields that have no value and identify who is permitted to provide each value.",
      inputSchema: emptySchema,
      annotations: { readOnlyHint: true },
      execute: () => {
        const missing = getMissingFields(context.getState()).map((field) => ({
          fieldId: field.id,
          label: field.label,
          reason: field.inference,
          requiredFrom: field.authority === "ASK" ? "human" : "agent_or_human",
        }));
        return {
          ok: true,
          complete: missing.length === 0,
          missing,
        };
      },
    },
    {
      name: "propose_answer",
      title: "Propose an answer",
      description:
        "Prepare an evidence-based answer for one field without committing it. Refuses fields, such as household income, that lack evidence and require direct human input.",
      inputSchema: {
        type: "object",
        properties: { fieldId: fieldIdSchema },
        required: ["fieldId"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: (input) => {
        if (!isFieldId(input.fieldId)) return invalidField();
        const field = context.getState().fields[input.fieldId];
        if (field.id === "householdIncome") {
          context.record({
            type: "ASK",
            title: "Refused to infer household income",
            detail: "The requested proposal had no supporting financial evidence.",
            evidence: "Human input required",
          });
          return {
            ok: false,
            code: "HUMAN_INPUT_REQUIRED",
            message:
              "No household-income evidence exists. A proposal would be fabrication, so the human must provide this value.",
          };
        }
        return {
          ok: true,
          fieldId: field.id,
          proposedAnswer: field.value,
          evidenceUsed: field.evidence,
          conciseBasis: field.inference,
          confidence: field.confidence,
          committed: false,
        };
      },
    },
    {
      name: "set_application_field",
      title: "Set an application field",
      description:
        "Commit an agent-drafted value to an allowed field. Household income is human-only and this tool always refuses to set it.",
      inputSchema: {
        type: "object",
        properties: {
          fieldId: fieldIdSchema,
          value: {
            type: "string",
            minLength: 1,
            description: "The evidence-based answer to commit as an agent draft.",
          },
        },
        required: ["fieldId", "value"],
        additionalProperties: false,
      },
      execute: (input) => {
        if (!isFieldId(input.fieldId)) return invalidField();
        if (typeof input.value !== "string") {
          return {
            ok: false,
            code: "INVALID_VALUE",
            message: "value must be a non-empty string.",
          };
        }
        return context.applyTransition((state) =>
          setApplicationFieldByAgent(state, input.fieldId as FieldId, input.value as string),
        );
      },
    },
    {
      name: "explain_answer",
      title: "Explain an answer",
      description:
        "Explain the evidence, bounded inference, confidence, and human-review status for one answer without exposing hidden chain-of-thought.",
      inputSchema: {
        type: "object",
        properties: { fieldId: fieldIdSchema },
        required: ["fieldId"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: (input) => {
        if (!isFieldId(input.fieldId)) return invalidField();
        const field = context.getState().fields[input.fieldId];
        return {
          ok: true,
          fieldId: field.id,
          answer: field.value || null,
          evidenceUsed: field.evidence,
          conciseBasis: field.inference,
          confidence: field.confidence,
          humanReviewed: field.reviewed,
          authority: field.authority,
        };
      },
    },
    {
      name: "get_submission_preview",
      title: "Preview submission",
      description:
        "Read the final submission summary, completeness, unresolved inferences, evidence count, and authorization status. Does not submit.",
      inputSchema: emptySchema,
      annotations: { readOnlyHint: true },
      execute: () => ({ ok: true, ...getSubmissionPreview(context.getState()) }),
    },
    {
      name: "request_submission_authorization",
      title: "Request human authorization",
      description:
        "Open the human authorization boundary for a complete application. This tool can request consent but cannot grant it.",
      inputSchema: emptySchema,
      execute: () => context.applyTransition(requestSubmissionAuthorization),
    },
    {
      name: "submit_application",
      title: "Submit application",
      description:
        "Submit the complete application only after explicit human authorization has been recorded. Returns CONSENT_REQUIRED before authorization.",
      inputSchema: emptySchema,
      execute: () => context.applyTransition(submitApplication),
    },
  ];
}

export async function registerConsentTools(
  modelContext: ModelContextLike,
  tools: WebMcpTool[],
  signal: AbortSignal,
): Promise<void> {
  await Promise.all(
    tools.map((tool) => modelContext.registerTool(tool, { signal })),
  );
}
