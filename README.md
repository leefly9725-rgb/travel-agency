# LongDingsheng Ops V1

A lightweight full-stack starter for the internal operations system of LongDingsheng International Travel in Serbia.

## Current V1 functions
- Quote management
  - `/quotes.html`: quote list, detail entry, delete
  - `/quote-new.html`: create a new quote
  - `/quote-detail.html?id=...`: quote detail view
  - Save quote data to local JSON storage in `data/seed.json`
  - Quote item types supported: hotel, vehicle, guide, interpreter, dining, tickets, meeting, parking, misc
  - Reuse quote calculation logic for total cost, total price, gross profit, and gross margin
- Reception task management
  - `/receptions.html`: create, edit, filter, and delete reception tasks
  - Filters supported: status, assignee, date
  - Fields include task type, title, assignee, due time, status, location, notes
- Document source data preview
  - `/documents.html`: preview source data for quote document, itinerary, airport pickup confirmation, vehicle service confirmation, guide task sheet
- Project Master Center (V1.1)
  - `/projects.html`: project list page
  - `/project-detail.html?id=...`: project archive detail page
  - Shows project name, client, date range, pax count, status, special requirements, linked quotes, linked reception tasks, linked document previews

## Tech choices
- Backend: Node.js native `http` server
- Frontend: static HTML, CSS, and vanilla JavaScript
- Data source: local JSON seed file
- Tests: `node --test --test-isolation=none`

## Run locally
1. Open a new terminal so the updated PATH is loaded.
2. Go to the project folder:
   `cd D:\LDS-OPS-v1`
3. Start the app:
   `npm start`
4. Open your browser:
   `http://localhost:3000`

## Main pages
- Home: `http://localhost:3000/`
- Quote list: `http://localhost:3000/quotes.html`
- Create quote: `http://localhost:3000/quote-new.html`
- Reception tasks: `http://localhost:3000/receptions.html`
- Document previews: `http://localhost:3000/documents.html`
- Project center: `http://localhost:3000/projects.html`

## Available scripts
- `npm start`: start the server
- `npm run dev`: start the server
- `npm test`: run tests

## Environment variables
Copy `.env.example` if you want custom values.
- `PORT`: server port, default `3000`
- `DATA_FILE`: seed data path, default `./data/seed.json`
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key for later frontend/public use
- `SUPABASE_ANON_KEY`: Supabase anon key for later client/API integration
- `SUPABASE_SERVICE_ROLE_KEY`: server-only key, never expose to frontend or commit to GitHub

## Main files
- `server/app.js`: HTTP routes and JSON APIs
- `server/services/quoteService.js`: quote calculation logic
- `server/services/documentPreviewService.js`: document preview builders
- `data/seed.json`: local demo storage
- `web/ui-labels.js`: central Chinese UI label mapping
- `web/styles.css`: shared styles
- `web/*.html` and `web/*.js`: page files
- `tests/api.test.js`: API tests
- `tests/quoteService.test.js`: quote calculation tests

## Supabase preparation
The app still runs on local JSON by default. Supabase is prepared as the next deployment step and is not forced yet.

1. Create a local `.env` file from `.env.example`
2. Fill in your Supabase project URL and keys
3. In Supabase SQL Editor, run `scripts/supabase-schema.sql`
4. Keep `.env` local only. The repository already ignores it via `.gitignore`

Current behavior:
- Local development still reads and writes `data/seed.json`
- Supabase config is loaded from `.env`
- `/api/meta` now exposes whether Supabase keys are configured, so we can verify readiness before migration
