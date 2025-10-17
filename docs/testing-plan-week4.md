# Week 4 Testing Plan

## Goals
- Validate the new App Router pages (/documents, /requirements, /permits, /training) render bilingual content, filters, and table interactions.
- Confirm end-to-end flows with mocked API responses for uploads, requirement completion, and renewal reminders.
- Provide confidence that core compliance flows remain usable even while backend responses are unavailable.

## Tooling
- **Cypress 13** for browser automation.
- **Cypress intercepts** to stub FastAPI routes (`/auth/me`, `/documents`, `/requirements`, `/permits`, `/training`, `/requirements/:id/complete`, `/auth/me` PATCH).
- **Fixtures** stored under `cypress/fixtures` to keep representative payloads for each API.

## Test Suites
### End-to-End (Cypress)
1. **Documents overview**
   - Stub uploads list, ensure recent uploads render, bilingual toggle updates labels, and upload errors raise toasts.
2. **Requirements workflow**
   - Validate filtering (all, overdue, 7/30 day windows).
   - Complete a requirement and assert success toast plus re-fetch.
3. **Permit renewals**
   - Display status badges (active/expiring/expired) and raise reminder toast on renew.
4. **Training renewals**
   - Surface expiry badges and toast reminders when renewing certs.

Each spec bootstraps intercepts in `beforeEach`, so runs are deterministic and independent of the FastAPI service.

### Unit/Integration Follow-ups (future sprints)
- Extract table renderers into isolated components and cover with React Testing Library snapshots.
- Add locale reducer tests to guard against regression in translation toggles.
- Mock API service utilities (`apiFetch`) to ensure error parsing and credential handling stay stable.

## Test Data Management
- Fixtures mirror our schema and use near-realistic timestamps (overdue vs upcoming).
- Keep fixtures light (≤ 5 records) for fast tests.
- Update fixtures alongside schema changes—document in PR checklist.

## CI Recommendations
- Add `npm run lint` + `npm run cy:run` steps to the existing pipeline once dependencies are installed.
- Run Cypress in headless Chrome with environment variables: `NEXT_PUBLIC_API_URL` matching backend URL.
- Cache Cypress binary between runs for faster CI.

## Manual Checks
- Document upload still requires manual backend confirmation (LLM extraction) — smoke test weekly.
- Stripe flows remain out-of-scope this sprint.
