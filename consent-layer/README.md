# The Consent Layer

**Agents can act. Humans stay in control.**

The Consent Layer is a polished, deterministic hackathon MVP for one fictional Future Builders Scholarship application. It demonstrates a narrow but important agent-native question: when an AI agent can act on the web, how does it know when to stop and ask a human?

The interface makes every application state visible—what the agent read, inferred, drafted, could not determine, and is not authorized to do. Submission is enforced by the application state machine and remains impossible until a deliberate human hold gesture records authorization.

## Demo flow

1. Open the workspace. Seven of eight answers are already supported by mock evidence or clearly marked agent drafts.
2. Inspect any **Why this answer?** disclosure to see its evidence, bounded explanation, confidence, and review status.
3. Notice that household income is missing. No supplied evidence contains it, so the agent stops rather than inventing a value.
4. Enter an annual household income directly in the financial section.
5. Select **Review & authorize**.
6. Release the authorization control early to see it reset, then hold it to completion.
7. The human authorization event is appended to the audit trail. The agent can then complete `submit_application`, and the success state appears.
8. Select **Reset demo** to return to the exact seeded state.

Everything is local and deterministic. There is no authentication, database, external scholarship API, or persistence layer.

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Run the full verification suite:

```bash
npm run check
npm run build
```

`npm run check` runs ESLint, TypeScript, and the consent-boundary tests. The production build uses webpack to avoid Turbopack's local CSS worker-port requirement in restricted CI or sandbox environments.

## WebMCP implementation

The browser integration uses the current imperative WebMCP shape:

```ts
await document.modelContext.registerTool(tool, { signal });
```

Ten granular tools are registered in [`lib/webmcp.ts`](./lib/webmcp.ts):

| Tool | Authority | Purpose |
| --- | --- | --- |
| `inspect_application` | READ | Read current fields, provenance, and completion state |
| `inspect_eligibility` | READ | Inspect criteria and the evidence-backed assessment |
| `inspect_available_evidence` | READ | List the three available sources and the known financial gap |
| `get_missing_information` | READ | Identify incomplete fields and who must provide them |
| `propose_answer` | DRAFT | Prepare one supported answer without committing it |
| `set_application_field` | DRAFT | Commit an allowed agent draft |
| `explain_answer` | READ | Return concise evidence and confidence—not hidden chain-of-thought |
| `get_submission_preview` | READ | Inspect completeness and authorization status |
| `request_submission_authorization` | CONSENT | Open the human consent boundary without granting approval |
| `submit_application` | CONSENT | Submit only when explicit human authorization exists |

The API is feature-detected. In a WebMCP-enabled secure browser context, the tools register natively on `document.modelContext`. Elsewhere, the same tool definitions are exposed at `window.__consentLayerTools` as a transparent demo bridge so they can be inspected during development. The bridge does not weaken the consent checks because every mutation still passes through the same state machine.

## Consent architecture

The security boundary lives in [`lib/application.ts`](./lib/application.ts), separate from the visual controls.

```text
agent requests authorization
          ↓
application completeness checked
          ↓
human holds authorization control
          ↓
humanApprovedSubmission = true
          ↓
submit_application may succeed
```

Two independent rules are enforced:

- `set_application_field` always rejects `householdIncome` with `HUMAN_INPUT_REQUIRED`. The only permitted path for that value is the human-facing input.
- `submit_application` always returns `CONSENT_REQUIRED` until `authorizeSubmission(state, "human")` has recorded explicit authorization.

Calling `request_submission_authorization` only opens the boundary. It cannot approve anything. Even a direct tool invocation of `submit_application` before the hold gesture receives a structured failure.

After authorization, the audit trail permanently records:

```text
HUMAN AUTHORIZATION
Submission approved
Initiated by: Human
Requested by: Agent
Action: submit_application
```

The automated tests in [`tests/consent-engine.test.ts`](./tests/consent-engine.test.ts) cover the missing-data refusal, attempted agent authorization, pre-consent submission failure, post-consent success, audit event, tool granularity, and tool registration.

## Project structure

```text
app/
  components/consent-workspace.tsx  Interactive workspace and hold gesture
  globals.css                       Visual system, motion, and responsive layout
  layout.tsx                        Metadata and root layout
  page.tsx                       Page entry point
lib/
  application.ts                    Deterministic state machine and security gates
  webmcp.ts                         Tool schemas, handlers, and registration
tests/
  consent-engine.test.ts            Security and WebMCP contract tests
types/
  webmcp.d.ts                       Experimental browser API declarations
```

## Deployment

The application is statically prerendered and deploys to Vercel without environment variables or external services.

1. Import the GitHub repository into Vercel.
2. Set the project root directory to `consent-layer` if the repository root is one directory above the Next.js application.
3. Keep the default install command (`npm install`) and build command (`npm run build`).
4. Deploy.

Native WebMCP requires a browser implementation that exposes `document.modelContext` in a secure context. The complete human consent workflow remains available in browsers without that experimental API.
