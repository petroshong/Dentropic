# Dental MCP (OpenDental Replacement Foundation)

This MCP server is designed to let dental teams run OpenDental-like workflows directly in ChatGPT through MCP tools.

## Implemented capability groups

- Patient + Family
  - `upsert-patient`
  - `search-patients`
  - `upsert-family-member`
- Scheduling
  - `schedule-appointment`
  - `set-appointment-status`
  - `add-provider-schedule-block`
  - `find-open-slots`
  - `book-appointment-slot`
- Imaging + AI triage
  - `ingest-dental-image`
  - `analyze-dental-image` (model-backed when configured)
- Insurance + Treatment Plans
  - `add-insurance-plan`
  - `list-insurance-plans`
  - `create-treatment-plan`
  - `add-treatment-plan-item`
  - `estimate-treatment-plan`
- Account / Ledger
  - `post-ledger-entry`
  - `get-account-snapshot`
- Chart / Recall / Comms / Tasks
  - `add-chart-entry`
  - `get-chart`
  - `set-recall`
  - `list-recall-due`
  - `add-communication-log`
  - `list-communication-log`
  - `upsert-task`
  - `list-tasks`
- Operations + Migration
  - `get-dashboard`
  - `import-opendental-snapshot`
  - `get-patient-workspace`
  - `list-audit-events`
  - `system-readiness`

## Security controls in this build

- Role-based authorization per tool action.
- Purpose-of-use checks for sensitive reads (`actor.purpose`) when enabled.
- Audit events for read/write operations.
- Optional encryption for PHI text notes via `PHI_ENCRYPTION_KEY`.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Open inspector: [http://localhost:3000/inspector](http://localhost:3000/inspector)

## Cloudflare mode

1. Set `DATA_BACKEND=cloudflare`
2. Configure:
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_D1_DATABASE_ID`
   - `CLOUDFLARE_API_TOKEN`
3. Apply schema: `schema/d1.sql`

## OpenDental migration path

Use `import-opendental-snapshot` with exported JSON data including patients, appointments, insurance, treatment plans/items, and ledger entries.

## Environment variables

See `.env.example` for all runtime flags, including:

- model analysis: `OPENAI_API_KEY`, `OPENAI_API_BASE_URL`, `DENTAL_IMAGE_MODEL`
- PHI controls: `PHI_ENCRYPTION_KEY`, `REQUIRE_PURPOSE_ON_SENSITIVE_READS`

## Notes

- Patient, scheduling, insurance, treatment, ledger, chart, recall, communication, and task domains now persist through repository-backed storage.
- With `DATA_BACKEND=cloudflare`, these domains persist in Cloudflare D1 tables defined in `schema/d1.sql`.
- Clinical outputs are triage support only, not diagnosis.
