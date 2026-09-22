# AGENTS.md

## Repository role

EchoRent is a voice-first airport car-rental agent.

The canonical product implementation is this repository.

Tenzy owns backend, AssemblyAI integration, agent tools, validation,
business rules, secrets, and backend reliability.

Seng owns frontend design, components, visual UX, transcript presentation,
car-card presentation, and responsive behavior.

Read PROJECT.md before substantial implementation work.

## Current phase

Frontend + Voice Integration v1.

Read `PROJECT.md` for the current product and phase scope.

Do not expand this phase.

## Sources of truth

Business truth:

- `backend/search.mjs`
- `backend/demo-inventory.mjs`

Agent configuration:

- `agents/echorent.jsonc`

Product and phase scope:

- `PROJECT.md`

Frontend visual implementation:

- Seng's imported components under `src/`

Important:

`docs/backend-contract.md` was imported from Seng's UI snapshot and is stale
at the start of Frontend + Voice Integration v1.

Do not treat it as authoritative until this phase rewrites it to the approved
Integration v1 contract.

Until then, the canonical backend files, `PROJECT.md`, and the explicitly
approved Integration v1 implementation plan take precedence over that file.

## Hard boundaries

- DXB and SIN only.
- Demo inventory only.
- Backend owns validation, eligibility, pricing, sorting, and inventory.
- React must not duplicate business logic.
- Maximum 3 search results.
- Do not fabricate vehicles, prices, IDs, booking references, or status.
- Do not expose ASSEMBLYAI_API_KEY or ECHORENT_TOOL_SECRET to browser code.
- Do not hardcode the AssemblyAI agent ID.
- Do not activate booking, reservation, agreement submission, email,
  Google authentication, database, approval, payment, or live inventory.
- RenterForm and AgreementCard may remain as visual/Storybook components
  but are unreachable from the Integration v1 runtime.
- Preserve Seng's visual design unless integration requires a functional fix.

## Search architecture

search_cars is the only runtime search tool in Integration v1.

Flow:

AssemblyAI tool.call(search_cars)
→ browser POST /api/search_cars
→ backend searchCars()
→ one authoritative response body
→ same body sent as tool.result
→ same parsed body rendered by the UI adapter.

Do not:
- parse Shen transcript to infer cars;
- perform a second independent search for the UI;
- use shared mock JSON as runtime truth;
- implement eligibility or pricing in frontend code.

## Browser/backend boundary

Browser-facing routes for this phase:

GET /api/voice/token
POST /api/search_cars

POST /api/search_cars must call the same canonical searchCars()
implementation used by the backend.

The permanent AssemblyAI API key remains server-side.

## Frontend adapter

Frontend mapping is presentation-only:

car_id → id
daily_rate → pricePerDay
economy → Economy
suv → SUV
premium → Premium
automatic → Automatic

Do not filter, sort, price, or determine eligibility in the adapter.

Backend IDs and values win over old frontend mocks.

## AssemblyAI rules

- Wait for session.ready before sending audio.
- Start the real voice session only after a user gesture.
- Send session.end for clean termination.
- Handle session.error as a real failure.
- Do not fabricate fallback success.
- Pending tool results must never survive an interrupted/ended turn.
- Preserve Shen's prompt unless explicitly approved.
- Do not publish/update the stored agent without Tenzy's explicit approval.

## Git workflow

One phase → one branch → one PR.

Current integration branch must remain based on canonical main.

Do not merge the unrelated UI branch into this branch.

Seng's frontend is a pinned selective snapshot from:

d46ca35004876f0a0e5e9aafb641f64f4e343e24

Preserve Seng's authorship when commits are eventually authorized.

Do not commit, push, open a PR, or publish Shen unless Tenzy explicitly
authorizes that step.

## Required verification

Before reporting implementation complete, run:

node --test backend/search.test.mjs
npm test
npm run build
npm run build-storybook

Also inspect:

git status
git diff main --stat

Verify no secrets appear in src/ or dist/.

Report actual command results. Never claim tests passed without running them.
