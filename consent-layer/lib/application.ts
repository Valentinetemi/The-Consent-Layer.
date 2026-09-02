export type Authority = "READ" | "DRAFT" | "ASK" | "CONSENT";

export type FieldStatus = "verified" | "inferred" | "draft" | "missing";

export type FieldId =
  | "fullName"
  | "country"
  | "university"
  | "fieldOfStudy"
  | "graduationYear"
  | "householdIncome"
  | "academicGoals"
  | "personalStatement";

export type ActivityType =
  | "READ"
  | "INFERENCE"
  | "DRAFT"
  | "ASK"
  | "CONSENT"
  | "HUMAN"
  | "SUBMIT";

export interface EvidenceSource {
  id: string;
  name: string;
  kind: string;
  summary: string;
  verified: boolean;
}

export interface ApplicationField {
  id: FieldId;
  section: string;
  label: string;
  prompt: string;
  value: string;
  status: FieldStatus;
  authority: Authority;
  evidence: string[];
  inference: string;
  confidence: "Verified" | "High" | "Proposed" | "Unavailable";
  reviewed: boolean;
}

export interface ActivityEvent {
  id: number;
  type: ActivityType;
  title: string;
  detail: string;
  evidence?: string;
}

export type ToolRegistrationStatus =
  | "detecting"
  | "registered"
  | "preview"
  | "error";

export interface ApplicationState {
  fields: Record<FieldId, ApplicationField>;
  activity: ActivityEvent[];
  nextEventId: number;
  authorizationRequested: boolean;
  humanApprovedSubmission: boolean;
  consentSheetOpen: boolean;
  submitted: boolean;
  submissionId: string | null;
  toolRegistrationStatus: ToolRegistrationStatus;
}

export interface OperationResult {
  ok: boolean;
  code: string;
  message: string;
  [key: string]: unknown;
}

export interface TransitionResult {
  state: ApplicationState;
  result: OperationResult;
}

export const FIELD_ORDER: FieldId[] = [
  "fullName",
  "country",
  "university",
  "fieldOfStudy",
  "graduationYear",
  "householdIncome",
  "academicGoals",
  "personalStatement",
];

export const EVIDENCE_SOURCES: EvidenceSource[] = [
  {
    id: "academic-profile",
    name: "Academic profile",
    kind: "Verified record",
    summary:
      "University of Lagos, B.Sc. Computer Science, final-year status.",
    verified: true,
  },
  {
    id: "transcript",
    name: "Official transcript",
    kind: "PDF · 4 pages",
    summary: "Confirms active enrollment and academic standing.",
    verified: true,
  },
  {
    id: "profile-summary",
    name: "CV & profile summary",
    kind: "Verified profile",
    summary:
      "Contains identity, location, interests, and community tutoring work.",
    verified: true,
  },
];

export const ELIGIBILITY_REQUIREMENTS = [
  "Currently enrolled in an accredited undergraduate programme",
  "Studying a technology-related field",
  "Resident of an eligible African country",
  "Graduating between 2026 and 2028",
  "Demonstrated academic purpose and community impact",
];

const initialFields = (): Record<FieldId, ApplicationField> => ({
  fullName: {
    id: "fullName",
    section: "personal-information",
    label: "Full legal name",
    prompt: "Enter your name exactly as it appears on official records.",
    value: "Temiloluwa Valentine",
    status: "verified",
    authority: "READ",
    evidence: ["CV & profile summary"],
    inference: "Copied directly from a verified identity profile.",
    confidence: "Verified",
    reviewed: true,
  },
  country: {
    id: "country",
    section: "personal-information",
    label: "Country of residence",
    prompt: "Where do you currently reside?",
    value: "Nigeria",
    status: "verified",
    authority: "READ",
    evidence: ["CV & profile summary"],
    inference: "Copied directly from the applicant profile.",
    confidence: "Verified",
    reviewed: true,
  },
  university: {
    id: "university",
    section: "academic-background",
    label: "University",
    prompt: "Which university are you currently attending?",
    value: "University of Lagos",
    status: "verified",
    authority: "READ",
    evidence: ["Academic profile", "Official transcript"],
    inference: "The institution matches across both academic records.",
    confidence: "Verified",
    reviewed: true,
  },
  fieldOfStudy: {
    id: "fieldOfStudy",
    section: "academic-background",
    label: "Field of study",
    prompt: "What is your current course of study?",
    value: "Computer Science",
    status: "verified",
    authority: "READ",
    evidence: ["Academic profile", "Official transcript"],
    inference: "The programme name is stated directly in both records.",
    confidence: "Verified",
    reviewed: true,
  },
  graduationYear: {
    id: "graduationYear",
    section: "academic-background",
    label: "Expected graduation year",
    prompt: "When do you expect to complete your degree?",
    value: "2027",
    status: "inferred",
    authority: "DRAFT",
    evidence: ["Academic profile", "Official transcript"],
    inference:
      "Final-year status and the current academic calendar indicate a 2027 completion date.",
    confidence: "High",
    reviewed: false,
  },
  householdIncome: {
    id: "householdIncome",
    section: "financial-information",
    label: "Annual household income",
    prompt: "What is your household's total annual income before tax?",
    value: "",
    status: "missing",
    authority: "ASK",
    evidence: [],
    inference:
      "No financial record was provided. This value cannot be safely inferred.",
    confidence: "Unavailable",
    reviewed: false,
  },
  academicGoals: {
    id: "academicGoals",
    section: "personal-statement",
    label: "Academic goals",
    prompt: "Describe your academic goals for the next three years.",
    value:
      "Complete my Computer Science degree, deepen my work in human-centred AI, and pursue applied research that makes digital public services safer and more accessible.",
    status: "draft",
    authority: "DRAFT",
    evidence: ["Academic profile", "CV & profile summary"],
    inference:
      "Synthesised from the applicant's degree, research interests, and stated public-interest technology focus.",
    confidence: "Proposed",
    reviewed: false,
  },
  personalStatement: {
    id: "personalStatement",
    section: "personal-statement",
    label: "Personal statement",
    prompt:
      "How will this scholarship help you create a meaningful impact?",
    value:
      "I am studying Computer Science because the systems that shape opportunity should be understandable, accessible, and worthy of trust. At university, I have paired technical study with peer tutoring and projects focused on practical access to digital services. The Future Builders Scholarship would give me the time and resources to complete my final year with focus, deepen my work in human-centred AI, and turn that work into tools that help people navigate important decisions with greater confidence. I hope to contribute to a generation of African technologists who build not only capable systems, but responsible ones.",
    status: "draft",
    authority: "DRAFT",
    evidence: ["Academic profile", "CV & profile summary"],
    inference:
      "Drafted from documented studies, tutoring experience, and public-interest technology goals. No new biographical claims were added.",
    confidence: "Proposed",
    reviewed: false,
  },
});

const initialActivity = (): ActivityEvent[] => [
  {
    id: 1,
    type: "READ",
    title: "Inspected eligibility requirements",
    detail: "Matched five published requirements against the applicant profile.",
    evidence: "Scholarship criteria",
  },
  {
    id: 2,
    type: "READ",
    title: "Found required evidence",
    detail: "Academic profile, transcript, and CV are present and internally consistent.",
    evidence: "3 verified sources",
  },
  {
    id: 3,
    type: "INFERENCE",
    title: "Graduation year → 2027",
    detail: "Derived from final-year status and the current academic calendar.",
    evidence: "High confidence",
  },
  {
    id: 4,
    type: "DRAFT",
    title: "Prepared narrative responses",
    detail: "Drafted academic goals and a personal statement using only supplied evidence.",
    evidence: "2 proposed answers",
  },
  {
    id: 5,
    type: "ASK",
    title: "Household income unavailable",
    detail: "No financial source exists. The agent stopped instead of guessing.",
    evidence: "Human input required",
  },
];

export function createInitialState(): ApplicationState {
  return {
    fields: initialFields(),
    activity: initialActivity(),
    nextEventId: 6,
    authorizationRequested: false,
    humanApprovedSubmission: false,
    consentSheetOpen: false,
    submitted: false,
    submissionId: null,
    toolRegistrationStatus: "detecting",
  };
}

export function getMissingFields(state: ApplicationState): ApplicationField[] {
  return FIELD_ORDER.map((id) => state.fields[id]).filter(
    (field) => !field.value.trim(),
  );
}

export function getPreparedCount(state: ApplicationState): number {
  return FIELD_ORDER.filter((id) => state.fields[id].value.trim()).length;
}

export function getSubmissionPreview(state: ApplicationState) {
  const missingFields = getMissingFields(state);
  const unresolvedInferences = FIELD_ORDER.filter((id) => {
    const field = state.fields[id];
    return field.status === "inferred" && field.confidence !== "High";
  });

  return {
    scholarship: "Future Builders Scholarship",
    answersPrepared: getPreparedCount(state),
    evidenceSourcesUsed: EVIDENCE_SOURCES.length,
    missingFields: missingFields.map((field) => field.id),
    unresolvedInferences,
    ready: missingFields.length === 0,
    humanApprovedSubmission: state.humanApprovedSubmission,
    submitted: state.submitted,
  };
}

function appendActivity(
  state: ApplicationState,
  event: Omit<ActivityEvent, "id">,
): ApplicationState {
  return {
    ...state,
    activity: [
      ...state.activity,
      {
        ...event,
        id: state.nextEventId,
      },
    ],
    nextEventId: state.nextEventId + 1,
  };
}

export function recordActivity(
  state: ApplicationState,
  event: Omit<ActivityEvent, "id">,
): ApplicationState {
  return appendActivity(state, event);
}

export function setToolRegistrationStatus(
  state: ApplicationState,
  status: ToolRegistrationStatus,
): ApplicationState {
  return { ...state, toolRegistrationStatus: status };
}

export function setConsentSheetOpen(
  state: ApplicationState,
  open: boolean,
): ApplicationState {
  return { ...state, consentSheetOpen: open };
}

export function setHumanHouseholdIncome(
  state: ApplicationState,
  value: string,
): TransitionResult {
  const numericValue = value.replace(/[₦,\s]/g, "");
  const amount = Number(numericValue);

  if (!numericValue || !Number.isFinite(amount) || amount <= 0) {
    return {
      state,
      result: {
        ok: false,
        code: "INVALID_HOUSEHOLD_INCOME",
        message: "Enter a valid annual household income greater than zero.",
      },
    };
  }

  const formatted = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);

  const field: ApplicationField = {
    ...state.fields.householdIncome,
    value: formatted,
    status: "verified",
    authority: "ASK",
    evidence: ["Direct human input"],
    inference: "Provided directly by the applicant. The agent did not infer this value.",
    confidence: "Verified",
    reviewed: true,
  };

  let nextState: ApplicationState = {
    ...state,
    fields: { ...state.fields, householdIncome: field },
    authorizationRequested: false,
    humanApprovedSubmission: false,
  };
  nextState = appendActivity(nextState, {
    type: "HUMAN",
    title: "Household income provided",
    detail: "A previously unknowable field was supplied directly by the applicant.",
    evidence: "Human-provided · verified",
  });

  return {
    state: nextState,
    result: {
      ok: true,
      code: "HUMAN_INPUT_RECORDED",
      message: "Household income recorded as direct human input.",
      field: "householdIncome",
      value: formatted,
    },
  };
}

export function setApplicationFieldByAgent(
  state: ApplicationState,
  fieldId: FieldId,
  value: string,
): TransitionResult {
  if (fieldId === "householdIncome") {
    return {
      state,
      result: {
        ok: false,
        code: "HUMAN_INPUT_REQUIRED",
        message:
          "Household income has no supporting evidence and cannot be set by an agent. Ask the human to provide it in the application interface.",
        field: fieldId,
      },
    };
  }

  if (!value.trim()) {
    return {
      state,
      result: {
        ok: false,
        code: "INVALID_VALUE",
        message: "A non-empty proposed value is required.",
        field: fieldId,
      },
    };
  }

  const previous = state.fields[fieldId];
  const field: ApplicationField = {
    ...previous,
    value: value.trim(),
    status: "draft",
    authority: "DRAFT",
    confidence: "Proposed",
    reviewed: false,
  };

  let nextState: ApplicationState = {
    ...state,
    fields: { ...state.fields, [fieldId]: field },
    humanApprovedSubmission: false,
    authorizationRequested: false,
  };
  nextState = appendActivity(nextState, {
    type: "DRAFT",
    title: `Updated ${previous.label.toLowerCase()}`,
    detail: "The agent changed a proposed answer. Human review remains available.",
    evidence: previous.evidence.join(" · ") || "No evidence attached",
  });

  return {
    state: nextState,
    result: {
      ok: true,
      code: "FIELD_UPDATED",
      message: `${previous.label} updated as an agent draft.`,
      field: fieldId,
      reviewed: false,
    },
  };
}

export function requestSubmissionAuthorization(
  state: ApplicationState,
): TransitionResult {
  const preview = getSubmissionPreview(state);
  if (!preview.ready) {
    return {
      state,
      result: {
        ok: false,
        code: "APPLICATION_INCOMPLETE",
        message: "Authorization cannot be requested until every required field is complete.",
        missingFields: preview.missingFields,
      },
    };
  }

  let nextState: ApplicationState = {
    ...state,
    authorizationRequested: true,
    consentSheetOpen: true,
  };
  nextState = appendActivity(nextState, {
    type: "CONSENT",
    title: "Reached the authority boundary",
    detail: "The application is ready. Explicit human authorization is now required.",
    evidence: "Agent cannot approve submission",
  });

  return {
    state: nextState,
    result: {
      ok: true,
      code: "AUTHORIZATION_REQUESTED",
      message: "The human authorization interface is now open.",
      preview,
    },
  };
}

export function authorizeSubmission(
  state: ApplicationState,
  actor: "human" | "agent",
): TransitionResult {
  if (actor !== "human") {
    return {
      state,
      result: {
        ok: false,
        code: "HUMAN_AUTHORIZATION_ONLY",
        message: "Submission authorization can only be recorded from a deliberate human gesture.",
      },
    };
  }

  if (!state.authorizationRequested || !getSubmissionPreview(state).ready) {
    return {
      state,
      result: {
        ok: false,
        code: "AUTHORIZATION_NOT_REQUESTED",
        message: "A complete submission preview must be requested before authorization.",
      },
    };
  }

  let nextState: ApplicationState = {
    ...state,
    humanApprovedSubmission: true,
  };
  nextState = appendActivity(nextState, {
    type: "HUMAN",
    title: "Submission approved",
    detail: "Initiated by: Human · Requested by: Agent · Action: submit_application",
    evidence: "HUMAN AUTHORIZATION",
  });

  return {
    state: nextState,
    result: {
      ok: true,
      code: "HUMAN_AUTHORIZATION_RECORDED",
      message: "Explicit human authorization has been recorded.",
    },
  };
}

export function submitApplication(state: ApplicationState): TransitionResult {
  if (!state.humanApprovedSubmission) {
    return {
      state,
      result: {
        ok: false,
        code: "CONSENT_REQUIRED",
        message:
          "Explicit human authorization has not been recorded. Call request_submission_authorization and wait for the human to complete the hold gesture.",
      },
    };
  }

  const preview = getSubmissionPreview(state);
  if (!preview.ready) {
    return {
      state,
      result: {
        ok: false,
        code: "APPLICATION_INCOMPLETE",
        message: "The application became incomplete after authorization.",
        missingFields: preview.missingFields,
      },
    };
  }

  if (state.submitted) {
    return {
      state,
      result: {
        ok: true,
        code: "ALREADY_SUBMITTED",
        message: "The application was already submitted.",
        submissionId: state.submissionId,
      },
    };
  }

  const submissionId = "FBS-2027-TMV-0142";
  let nextState: ApplicationState = {
    ...state,
    submitted: true,
    submissionId,
  };
  nextState = appendActivity(nextState, {
    type: "SUBMIT",
    title: "Application submitted",
    detail: "Submission completed after the authorization gate was satisfied.",
    evidence: submissionId,
  });

  return {
    state: nextState,
    result: {
      ok: true,
      code: "APPLICATION_SUBMITTED",
      message: "Future Builders Scholarship application submitted successfully.",
      submissionId,
      authorization: "human",
    },
  };
}

export function resetDemo(): ApplicationState {
  return createInitialState();
}
