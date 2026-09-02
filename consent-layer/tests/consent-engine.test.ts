import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeSubmission,
  createInitialState,
  getMissingFields,
  getSubmissionPreview,
  recordActivity,
  requestSubmissionAuthorization,
  setApplicationFieldByAgent,
  setHumanHouseholdIncome,
  submitApplication,
  type ApplicationState,
  type TransitionResult,
} from "../lib/application.ts";
import {
  buildConsentTools,
  registerConsentTools,
  type ModelContextLike,
} from "../lib/webmcp.ts";

test("the seeded application deliberately omits household income", () => {
  const state = createInitialState();
  assert.deepEqual(
    getMissingFields(state).map((field) => field.id),
    ["householdIncome"],
  );
  assert.equal(getSubmissionPreview(state).ready, false);
});

test("an agent cannot invent or set household income", () => {
  const initial = createInitialState();
  const outcome = setApplicationFieldByAgent(
    initial,
    "householdIncome",
    "₦4,800,000",
  );

  assert.equal(outcome.result.ok, false);
  assert.equal(outcome.result.code, "HUMAN_INPUT_REQUIRED");
  assert.equal(outcome.state, initial);
  assert.equal(outcome.state.fields.householdIncome.value, "");
});

test("submit_application returns CONSENT_REQUIRED before human approval", () => {
  let state = createInitialState();
  state = setHumanHouseholdIncome(state, "4800000").state;

  const outcome = submitApplication(state);
  assert.equal(outcome.result.ok, false);
  assert.equal(outcome.result.code, "CONSENT_REQUIRED");
  assert.equal(outcome.state.submitted, false);
});

test("only a human can cross the authorization boundary", () => {
  let state = createInitialState();
  state = setHumanHouseholdIncome(state, "4800000").state;
  state = requestSubmissionAuthorization(state).state;

  const agentAttempt = authorizeSubmission(state, "agent");
  assert.equal(agentAttempt.result.code, "HUMAN_AUTHORIZATION_ONLY");
  assert.equal(agentAttempt.state.humanApprovedSubmission, false);

  const humanApproval = authorizeSubmission(state, "human");
  assert.equal(humanApproval.result.code, "HUMAN_AUTHORIZATION_RECORDED");
  assert.equal(humanApproval.state.humanApprovedSubmission, true);
  assert.equal(
    humanApproval.state.activity.at(-1)?.evidence,
    "HUMAN AUTHORIZATION",
  );
});

test("a complete human-authorized application submits successfully", () => {
  let state = createInitialState();
  state = setHumanHouseholdIncome(state, "4,800,000").state;
  state = requestSubmissionAuthorization(state).state;
  state = authorizeSubmission(state, "human").state;

  const outcome = submitApplication(state);
  assert.equal(outcome.result.ok, true);
  assert.equal(outcome.result.code, "APPLICATION_SUBMITTED");
  assert.equal(outcome.state.submitted, true);
  assert.equal(outcome.state.submissionId, "FBS-2027-TMV-0142");
  assert.equal(outcome.state.activity.at(-1)?.type, "SUBMIT");
});

test("the WebMCP surface is granular and registers every tool", async () => {
  let state: ApplicationState = createInitialState();
  const applyTransition = (
    transition: (current: ApplicationState) => TransitionResult,
  ) => {
    const outcome = transition(state);
    state = outcome.state;
    return outcome.result;
  };
  const tools = buildConsentTools({
    getState: () => state,
    applyTransition,
    record: (event) => {
      state = recordActivity(state, event);
    },
  });

  assert.deepEqual(
    tools.map((tool) => tool.name),
    [
      "inspect_application",
      "inspect_eligibility",
      "inspect_available_evidence",
      "get_missing_information",
      "propose_answer",
      "set_application_field",
      "explain_answer",
      "get_submission_preview",
      "request_submission_authorization",
      "submit_application",
    ],
  );
  assert.equal(tools.some((tool) => tool.name === "complete_application"), false);

  const setField = tools.find((tool) => tool.name === "set_application_field");
  assert.ok(setField);
  const refusal = await setField.execute({
    fieldId: "householdIncome",
    value: "₦4,800,000",
  });
  assert.equal((refusal as { code: string }).code, "HUMAN_INPUT_REQUIRED");

  const registered: string[] = [];
  const modelContext: ModelContextLike = {
    async registerTool(tool) {
      registered.push(tool.name);
      return undefined;
    },
  };
  const controller = new AbortController();
  await registerConsentTools(modelContext, tools, controller.signal);
  assert.deepEqual(registered, tools.map((tool) => tool.name));
});
