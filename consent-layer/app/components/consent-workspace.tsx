"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  EVIDENCE_SOURCES,
  FIELD_ORDER,
  authorizeSubmission,
  createInitialState,
  getPreparedCount,
  getSubmissionPreview,
  recordActivity,
  requestSubmissionAuthorization,
  resetDemo,
  setConsentSheetOpen,
  setHumanHouseholdIncome,
  setToolRegistrationStatus,
  submitApplication,
  type ActivityEvent,
  type ApplicationField,
  type ApplicationState,
  type FieldId,
  type TransitionResult,
} from "@/lib/application";
import { buildConsentTools, registerConsentTools } from "@/lib/webmcp";

type IconName =
  | "arrow"
  | "check"
  | "chevron"
  | "document"
  | "eye"
  | "grip"
  | "lock"
  | "reset"
  | "shield"
  | "spark";

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m8 10 4 4 4-4" />,
    document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
    grip: <><circle cx="9" cy="7" r=".8" fill="currentColor" stroke="none" /><circle cx="15" cy="7" r=".8" fill="currentColor" stroke="none" /><circle cx="9" cy="12" r=".8" fill="currentColor" stroke="none" /><circle cx="15" cy="12" r=".8" fill="currentColor" stroke="none" /><circle cx="9" cy="17" r=".8" fill="currentColor" stroke="none" /><circle cx="15" cy="17" r=".8" fill="currentColor" stroke="none" /></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    reset: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>,
    shield: <><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
    spark: <><path d="m12 3 .8 3.2A4 4 0 0 0 15.8 9l3.2.8-3.2.8a4 4 0 0 0-3 2.9L12 17l-.8-3.5a4 4 0 0 0-3-2.9L5 9.8 8.2 9a4 4 0 0 0 3-2.8L12 3Z" /><path d="m19 16 .4 1.4a2 2 0 0 0 1.2 1.2L22 19l-1.4.4a2 2 0 0 0-1.2 1.2L19 22l-.4-1.4a2 2 0 0 0-1.2-1.2L16 19l1.4-.4a2 2 0 0 0 1.2-1.2L19 16Z" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const navigation = [
  { label: "Overview", id: "overview", state: "complete" },
  { label: "Eligibility", id: "eligibility", state: "complete" },
  { label: "Personal Information", id: "personal-information", state: "complete" },
  { label: "Academic Background", id: "academic-background", state: "complete" },
  { label: "Financial Information", id: "financial-information", state: "dynamic" },
  { label: "Personal Statement", id: "personal-statement", state: "draft" },
  { label: "Evidence", id: "evidence", state: "complete" },
  { label: "Certification", id: "certification", state: "consent" },
  { label: "Review", id: "review", state: "dynamic" },
];

const authorityItems = [
  { type: "READ", copy: "Inspect evidence", color: "green" },
  { type: "DRAFT", copy: "Prepare answers", color: "blue" },
  { type: "ASK", copy: "Request information", color: "amber" },
  { type: "CONSENT", copy: "Human only", color: "red" },
];

function StatusPill({ field }: { field: ApplicationField }) {
  const label = field.status === "verified" ? "Verified" : field.status === "inferred" ? "Inferred" : field.status === "draft" ? "Agent draft" : "Human required";
  return <span className={`field-status field-status--${field.status}`}><span className="field-status__dot" />{label}</span>;
}

function FieldExplanation({ field }: { field: ApplicationField }) {
  return (
    <div className="answer-explanation">
      <div className="explanation-grid">
        <div><span className="micro-label">Evidence used</span><p>{field.evidence.length ? field.evidence.join(" · ") : "No source available"}</p></div>
        <div><span className="micro-label">Confidence</span><p>{field.confidence}</p></div>
        <div className="explanation-grid__wide"><span className="micro-label">Bounded explanation</span><p>{field.inference}</p></div>
        <div><span className="micro-label">Human review</span><p>{field.reviewed ? "Reviewed" : "Not yet reviewed"}</p></div>
      </div>
    </div>
  );
}

function AnswerField({ field, expanded, onToggle }: { field: ApplicationField; expanded: boolean; onToggle: () => void }) {
  return (
    <article className="answer-field">
      <div className="answer-field__topline">
        <div><span className="question-number">0{FIELD_ORDER.indexOf(field.id) + 1}</span><h3>{field.label}</h3></div>
        <StatusPill field={field} />
      </div>
      <p className="answer-field__prompt">{field.prompt}</p>
      <div className={`answer-value ${field.id === "personalStatement" ? "answer-value--long" : ""}`}>{field.value}</div>
      <button className="why-button" type="button" onClick={onToggle} aria-expanded={expanded}>
        <Icon name="spark" size={14} />Why this answer?
        <span className={expanded ? "chevron chevron--open" : "chevron"}><Icon name="chevron" size={14} /></span>
      </button>
      <div className={expanded ? "explanation-wrap explanation-wrap--open" : "explanation-wrap"}><FieldExplanation field={field} /></div>
    </article>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="section-heading"><span>{eyebrow}</span><div><h2>{title}</h2><p>{description}</p></div></div>;
}

function IncomeField({ field, value, error, onChange, onSave }: { field: ApplicationField; value: string; error: string; onChange: (value: string) => void; onSave: () => void }) {
  const complete = Boolean(field.value);
  return (
    <article className={complete ? "income-boundary income-boundary--complete" : "income-boundary"}>
      <div className="income-boundary__icon"><Icon name={complete ? "check" : "lock"} size={18} /></div>
      <div className="income-boundary__content">
        <div className="income-boundary__head"><div><span className="question-number">06 · HUMAN INPUT</span><h3>{field.label}</h3></div><StatusPill field={field} /></div>
        <p>{field.prompt}</p>
        {!complete ? <>
          <div className="agent-stop-note"><span>Agent stopped</span>No evidence contains this value. Guessing is not permitted.</div>
          <div className="income-input-row">
            <label><span>Annual income in Nigerian naira</span><div className="currency-input"><span>₦</span><input value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onSave(); }} inputMode="numeric" placeholder="e.g. 4,800,000" aria-describedby={error ? "income-error" : undefined} /></div></label>
            <button className="save-answer" type="button" onClick={onSave}>Record answer<Icon name="arrow" size={15} /></button>
          </div>
          {error && <p className="input-error" id="income-error" role="alert">{error}</p>}
          <p className="privacy-note">Used only in this local demo. Nothing is sent to a server.</p>
        </> : <div className="human-answer"><div><span className="micro-label">Provided directly by you</span><strong>{field.value}</strong></div><button type="button" onClick={() => onChange(field.value.replace(/[^0-9]/g, ""))}>Edit</button></div>}
      </div>
    </article>
  );
}

function ActivityPanel({ events, registrationStatus }: { events: ActivityEvent[]; registrationStatus: ApplicationState["toolRegistrationStatus"] }) {
  const [expandedId, setExpandedId] = useState<number | null>(5);
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const positionRef = useRef(position);
  const startRef = useRef({ pointerX: 0, pointerY: 0, x: 0, y: 0 });

  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => {
      const nextX = startRef.current.x + event.clientX - startRef.current.pointerX;
      const nextY = startRef.current.y + event.clientY - startRef.current.pointerY;
      setPosition({
        x: Math.min(20, Math.max(-Math.max(0, window.innerWidth - 390), nextX)),
        y: Math.min(Math.max(40, window.innerHeight - 180), Math.max(-58, nextY)),
      });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("pointercancel", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging]);

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    startRef.current = { pointerX: event.clientX, pointerY: event.clientY, x: positionRef.current.x, y: positionRef.current.y };
    setDragging(true);
  };
  const statusCopy = registrationStatus === "registered" ? "Native WebMCP live" : registrationStatus === "error" ? "Registration needs attention" : registrationStatus === "preview" ? "10 tools · preview bridge" : "Detecting WebMCP";

  return (
    <aside className={dragging ? "activity-panel activity-panel--dragging" : "activity-panel"} style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${dragging ? 1.015 : 1})` }} aria-label="Agent activity">
      <div className="activity-panel__handle" onPointerDown={beginDrag}>
        <div><span className="live-indicator"><i />LIVE</span><h2>Agent Activity</h2></div>
        <span className="drag-grip" title="Drag panel"><Icon name="grip" size={19} /></span>
      </div>
      <div className="activity-panel__status"><span className={`webmcp-dot webmcp-dot--${registrationStatus}`} />{statusCopy}<span>WebMCP</span></div>
      <div className="activity-stream">
        {events.map((event, index) => {
          const open = expandedId === event.id;
          return (
            <article className={`activity-event activity-event--${event.type.toLowerCase()}`} key={event.id}>
              <div className="activity-event__rail"><span />{index < events.length - 1 && <i />}</div>
              <div className="activity-event__body">
                <span className="activity-event__type">{event.type}</span><h3>{event.title}</h3>
                <button type="button" onClick={() => setExpandedId(open ? null : event.id)} aria-expanded={open}>{open ? "Hide details" : "Why?"}<span className={open ? "chevron chevron--open" : "chevron"}><Icon name="chevron" size={12} /></span></button>
                <div className={open ? "event-detail event-detail--open" : "event-detail"}><div><p>{event.detail}</p>{event.evidence && <span>{event.evidence}</span>}</div></div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="activity-panel__footer"><Icon name="eye" size={14} />Evidence-based explanations only</div>
    </aside>
  );
}

function HoldToAuthorize({ onComplete, authorized }: { onComplete: () => void; authorized: boolean }) {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(authorized ? 1 : 0);
  const frameRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const completedRef = useRef(authorized);
  const holdDuration = 1700;

  useEffect(() => () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); }, []);

  const finish = useCallback(() => {
    completedRef.current = true;
    setHolding(false);
    setProgress(1);
    onComplete();
  }, [onComplete]);
  const begin = () => {
    if (completedRef.current || holding) return;
    setHolding(true);
    startedAtRef.current = performance.now();
    const tick = (time: number) => {
      const next = Math.min(1, (time - startedAtRef.current) / holdDuration);
      setProgress(next);
      if (next >= 1) { finish(); return; }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  };
  const cancel = () => {
    if (completedRef.current) return;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    setHolding(false);
    setProgress(0);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if ((event.key === " " || event.key === "Enter") && !event.repeat) { event.preventDefault(); begin(); }
  };
  const onKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === " " || event.key === "Enter") { event.preventDefault(); cancel(); }
  };

  return (
    <button className={`${holding ? "hold-button hold-button--active" : "hold-button"} ${authorized ? "hold-button--complete" : ""}`} type="button" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); begin(); }} onPointerUp={cancel} onPointerCancel={cancel} onKeyDown={onKeyDown} onKeyUp={onKeyUp} onContextMenu={(event) => event.preventDefault()} aria-label="Hold to authorize submission">
      <span className="hold-button__fill" style={{ width: `${progress * 100}%` }} />
      <span className="hold-button__content"><span className="hold-button__icon"><Icon name={authorized ? "check" : "lock"} size={17} /></span><span>{authorized ? "Authorization recorded" : holding ? "Keep holding…" : "Hold to Authorize"}</span>{!authorized && <small>{Math.round(progress * 100)}%</small>}</span>
    </button>
  );
}

function ConsentSheet({ state, onClose, onReview, onAuthorize }: { state: ApplicationState; onClose: () => void; onReview: () => void; onAuthorize: () => void }) {
  const preview = getSubmissionPreview(state);
  if (!state.consentSheetOpen) return null;
  return (
    <div className="consent-overlay" role="presentation">
      <section className={state.submitted ? "consent-sheet consent-sheet--success" : "consent-sheet"} role="dialog" aria-modal="true" aria-labelledby="consent-title">
        <div className="sheet-pull" />
        {state.submitted ? <div className="submission-success">
          <div className="success-mark"><Icon name="check" size={30} /><span /></div>
          <span className="consent-kicker">APPLICATION SUBMITTED</span>
          <h2 id="consent-title">Future Builders Scholarship</h2>
          <p>The agent completed the submission only after your authorization was recorded.</p>
          <div className="success-attributes"><span><Icon name="check" size={14} />Human-authorized</span><span><Icon name="spark" size={14} />Agent-assisted</span><span><Icon name="shield" size={14} />Evidence verified</span></div>
          <div className="submission-reference"><span>Submission reference</span><strong>{state.submissionId}</strong></div>
          <button className="success-close" type="button" onClick={onClose}>Return to application<Icon name="arrow" size={16} /></button>
        </div> : <>
          <div className="consent-sheet__head">
            <div className="consent-symbol"><Icon name="shield" size={22} /></div>
            <div><span className="consent-kicker">HUMAN AUTHORIZATION REQUIRED</span><h2 id="consent-title">Your agent has reached the boundary of its authority.</h2></div>
            <button className="sheet-close" type="button" onClick={onClose} aria-label="Close authorization sheet">×</button>
          </div>
          <p className="consent-intro">The agent has completed everything it is permitted to do. Submitting certifies that the information is accurate and final.</p>
          <div className="consent-metrics"><div><strong>{preview.answersPrepared}</strong><span>answers prepared</span></div><div><strong>{preview.evidenceSourcesUsed}</strong><span>evidence sources used</span></div><div><strong>{preview.missingFields.length}</strong><span>missing fields</span></div><div><strong>{preview.unresolvedInferences.length}</strong><span>unresolved inferences</span></div></div>
          <div className="consent-warning"><Icon name="lock" size={18} /><div><strong>This action cannot be initiated by the agent.</strong><p>Your hold is recorded as the explicit authorization event in the permanent audit trail.</p></div></div>
          <div className="consent-actions"><button className="review-button" type="button" onClick={onReview}>Review changes</button><HoldToAuthorize onComplete={onAuthorize} authorized={state.humanApprovedSubmission} /></div>
          {state.humanApprovedSubmission && <p className="agent-resuming"><span />Authorization recorded. The agent is resuming submission…</p>}
        </>}
      </section>
    </div>
  );
}

export default function ConsentWorkspace() {
  const [state, setState] = useState<ApplicationState>(() => createInitialState());
  const stateRef = useRef(state);
  const [expandedFields, setExpandedFields] = useState<Set<FieldId>>(
    () => new Set(["graduationYear"]),
  );
  const [incomeInput, setIncomeInput] = useState("");
  const [incomeError, setIncomeError] = useState("");
  const [activeSection, setActiveSection] = useState("overview");

  const replaceState = useCallback(
    (update: (current: ApplicationState) => ApplicationState) => {
      const next = update(stateRef.current);
      stateRef.current = next;
      setState(next);
      return next;
    },
    [],
  );

  const applyTransition = useCallback(
    (transition: (current: ApplicationState) => TransitionResult) => {
      const outcome = transition(stateRef.current);
      stateRef.current = outcome.state;
      setState(outcome.state);
      return outcome.result;
    },
    [],
  );

  const getState = useCallback(() => stateRef.current, []);
  const record = useCallback(
    (event: Omit<ActivityEvent, "id">) => {
      replaceState((current) => recordActivity(current, event));
    },
    [replaceState],
  );
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const tools = buildConsentTools({ getState, applyTransition, record });
    window.__consentLayerTools = Object.fromEntries(
      tools.map((tool) => [tool.name, tool]),
    );

    if (!document.modelContext) {
      replaceState((current) => setToolRegistrationStatus(current, "preview"));
      return () => {
        controller.abort();
        delete window.__consentLayerTools;
      };
    }

    registerConsentTools(document.modelContext, tools, controller.signal)
      .then(() => {
        if (active) {
          replaceState((current) =>
            setToolRegistrationStatus(current, "registered"),
          );
        }
      })
      .catch(() => {
        if (active && !controller.signal.aborted) {
          replaceState((current) =>
            setToolRegistrationStatus(current, "error"),
          );
        }
      });

    return () => {
      active = false;
      controller.abort();
      delete window.__consentLayerTools;
    };
  }, [applyTransition, getState, record, replaceState]);

  useEffect(() => {
    if (!state.humanApprovedSubmission || state.submitted) return;
    const timer = window.setTimeout(() => {
      applyTransition(submitApplication);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [applyTransition, state.humanApprovedSubmission, state.submitted]);

  const toggleField = (id: FieldId) => {
    setExpandedFields((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveIncome = () => {
    const result = applyTransition((current) =>
      setHumanHouseholdIncome(current, incomeInput),
    );
    if (!result.ok) {
      setIncomeError(result.message);
      return;
    }
    setIncomeInput("");
    setIncomeError("");
  };

  const editIncome = () => {
    setIncomeInput(state.fields.householdIncome.value.replace(/[^0-9]/g, ""));
    replaceState((current) => ({
      ...current,
      fields: {
        ...current.fields,
        householdIncome: {
          ...current.fields.householdIncome,
          value: "",
          status: "missing",
          confidence: "Unavailable",
          reviewed: false,
          evidence: [],
        },
      },
      authorizationRequested: false,
      humanApprovedSubmission: false,
      submitted: false,
      submissionId: null,
    }));
  };

  const closeAuthorization = () => {
    replaceState((current) => setConsentSheetOpen(current, false));
  };
  const reviewChanges = () => {
    closeAuthorization();
    window.setTimeout(() => {
      document
        .getElementById("review")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };
  const reset = () => {
    const status = stateRef.current.toolRegistrationStatus;
    const next = resetDemo();
    next.toolRegistrationStatus = status;
    stateRef.current = next;
    setState(next);
    setExpandedFields(new Set(["graduationYear"]));
    setIncomeInput("");
    setIncomeError("");
    setActiveSection("overview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const navigate = (id: string) => {
    setActiveSection(id);
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const preview = getSubmissionPreview(state);
  const progress = Math.round(
    (getPreparedCount(state) / FIELD_ORDER.length) * 100,
  );
  const personalFields: FieldId[] = ["fullName", "country"];
  const academicFields: FieldId[] = [
    "university",
    "fieldOfStudy",
    "graduationYear",
  ];
  const narrativeFields: FieldId[] = ["academicGoals", "personalStatement"];

  const renderFields = (ids: FieldId[]) => (
    <div className="field-list">
      {ids.map((id) => (
        <AnswerField
          key={id}
          field={state.fields[id]}
          expanded={expandedFields.has(id)}
          onToggle={() => toggleField(id)}
        />
      ))}
    </div>
  );

  return (
    <div className="consent-app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><span /></div>
          <div>
            <strong>THE CONSENT LAYER</strong>
            <span>Agents can act. Humans stay in control.</span>
          </div>
        </div>
        <div className="topbar-context">
          <span>WORKSPACE</span>
          <strong>Future Builders Scholarship</strong>
        </div>
        <button className="reset-button" type="button" onClick={reset}>
          <Icon name="reset" size={14} />Reset demo
        </button>
      </header>

      <div className="workspace-grid">
        <aside className="application-sidebar">
          <div className="application-sidebar__inner">
            <div className="scholarship-mini">
              <span className="scholarship-mini__seal">FB</span>
              <div><span>2027 APPLICATION</span><strong>Future Builders Scholarship</strong></div>
            </div>
            <div className="sidebar-progress">
              <div><span>Application progress</span><strong>{progress}%</strong></div>
              <div className="sidebar-progress__track"><i style={{ width: `${progress}%` }} /></div>
            </div>
            <nav className="section-nav" aria-label="Application sections">
              <span className="sidebar-label">APPLICATION</span>
              {navigation.map((item) => {
                const itemState = item.state === "dynamic"
                  ? state.fields.householdIncome.value ? "complete" : "blocked"
                  : item.state;
                return (
                  <button key={item.id} className={activeSection === item.id ? "section-nav__item section-nav__item--active" : "section-nav__item"} type="button" onClick={() => navigate(item.id)}>
                    <span className={`nav-dot nav-dot--${itemState}`}>{itemState === "complete" && <Icon name="check" size={9} />}</span>
                    {item.label}
                  </button>
                );
              })}
            </nav>
            <div className="authority-model">
              <div className="authority-model__head"><span className="sidebar-label">AGENT AUTHORITY</span><Icon name="shield" size={15} /></div>
              <div className="authority-rail">
                {authorityItems.map((item, index) => (
                  <div className="authority-item" key={item.type}>
                    <div className="authority-item__rail"><span className={`authority-node authority-node--${item.color}`} />{index < authorityItems.length - 1 && <i />}</div>
                    <div><strong>{item.type}</strong><span>{item.copy}</span></div>
                  </div>
                ))}
              </div>
              <p>Capability <span>≠</span> authority.</p>
            </div>
          </div>
        </aside>

        <main className="application-main">
          <section className="application-hero" id="overview">
            <div className="hero-kicker-row"><span>APPLICATION · 01 / 01</span><span className="eligible-pill"><Icon name="check" size={12} />Eligible</span></div>
            <h1>Future Builders<br />Scholarship</h1>
            <p>A transparent, agent-assisted application. Every answer shows where it came from—and where human authority begins.</p>
            <div className="capability-callout"><div><Icon name="shield" size={19} /></div><p><strong>Capability ≠ authority.</strong> The agent can read, reason, and draft. You alone can provide unknowable facts and authorize submission.</p></div>
          </section>

          <section className="content-section eligibility-section" id="eligibility">
            <SectionHeading eyebrow="00 · ELIGIBILITY" title="Eligibility confirmed" description="Five requirements checked against verified application evidence." />
            <div className="eligibility-line"><div className="eligibility-line__status"><Icon name="check" size={18} /></div><div><strong>5 of 5 requirements supported</strong><span>Academic profile · Transcript · Applicant profile</span></div><button type="button" onClick={() => navigate("evidence")}>View evidence <Icon name="arrow" size={14} /></button></div>
          </section>

          <section className="content-section" id="personal-information">
            <SectionHeading eyebrow="01 · PERSONAL INFORMATION" title="About you" description="Identity details copied from verified profile evidence." />
            {renderFields(personalFields)}
          </section>

          <section className="content-section" id="academic-background">
            <SectionHeading eyebrow="02 · ACADEMIC BACKGROUND" title="Your studies" description="Verified facts and one clearly marked high-confidence inference." />
            {renderFields(academicFields)}
          </section>

          <section className="content-section financial-section" id="financial-information">
            <SectionHeading eyebrow="03 · FINANCIAL INFORMATION" title="Financial context" description="Sensitive information is requested only when the evidence cannot answer." />
            <IncomeField field={state.fields.householdIncome} value={incomeInput} error={incomeError} onChange={(value) => { setIncomeInput(value); setIncomeError(""); }} onSave={saveIncome} />
            {state.fields.householdIncome.value && <button className="edit-income-shortcut" type="button" onClick={editIncome}>Edit human-provided answer</button>}
          </section>

          <section className="content-section" id="personal-statement">
            <SectionHeading eyebrow="04 · PERSONAL STATEMENT" title="Your direction" description="Proposed language grounded in documented goals and experience." />
            {renderFields(narrativeFields)}
          </section>

          <section className="content-section" id="evidence">
            <SectionHeading eyebrow="05 · EVIDENCE" title="Source record" description="The complete evidence set used by the agent in this application." />
            <div className="evidence-list">
              {EVIDENCE_SOURCES.map((source, index) => (
                <article key={source.id}><span className="evidence-index">0{index + 1}</span><div className="evidence-icon"><Icon name="document" size={18} /></div><div><strong>{source.name}</strong><p>{source.summary}</p></div><span className="evidence-kind"><Icon name="check" size={11} />{source.kind}</span></article>
              ))}
            </div>
          </section>

          <section className="content-section" id="certification">
            <SectionHeading eyebrow="06 · CERTIFICATION" title="Accuracy & finality" description="This attestation is completed by your authorization—not by the agent." />
            <div className="certification-copy"><Icon name="lock" size={19} /><p>By authorizing submission, I certify that the information in this application is accurate, complete, and final to the best of my knowledge.</p><span>HUMAN ONLY</span></div>
          </section>

          <section className="review-section" id="review">
            <div className="review-section__copy"><span>07 · REVIEW</span><h2>{preview.ready ? "Ready for your authorization." : "One answer needs you."}</h2><p>{preview.ready ? "All eight answers are prepared. The agent has reached the boundary of its authority." : "The agent has done everything it can. Provide household income to continue."}</p></div>
            <div className="review-summary"><div><span>Answers</span><strong>{getPreparedCount(state)} / 8</strong></div><div><span>Evidence</span><strong>3 verified</strong></div><div><span>Authorization</span><strong>{state.humanApprovedSubmission ? "Recorded" : "Not granted"}</strong></div></div>
            <button className="authorization-button" type="button" onClick={() => applyTransition(requestSubmissionAuthorization)} disabled={!preview.ready}><span><Icon name="lock" size={17} /></span>Review & authorize<Icon name="arrow" size={17} /></button>
            <p className="review-boundary-note"><Icon name="shield" size={14} />This action cannot be initiated by the agent.</p>
          </section>
        </main>
        <div className="activity-column" aria-hidden="true" />
      </div>

      <ActivityPanel events={state.activity} registrationStatus={state.toolRegistrationStatus} />
      <ConsentSheet state={state} onClose={closeAuthorization} onReview={reviewChanges} onAuthorize={() => applyTransition((current) => authorizeSubmission(current, "human"))} />
    </div>
  );
}
