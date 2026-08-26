# Disaster Intelligence Platform — India

> A decision-support workspace that brings official disaster alerts, map context, and evidence-grounded historical research into one multilingual interface.

![React](https://img.shields.io/badge/frontend-React%20%2B%20TypeScript-61dafb?logo=react&logoColor=white) ![Node](https://img.shields.io/badge/backend-Express%20%2B%20TypeScript-339933?logo=node.js&logoColor=white) ![License](https://img.shields.io/badge/license-MIT-blue)

## The problem

During an emergency, citizens and responders often need to reconcile a live official alert, its geographic relevance, protective guidance, and fragmented news coverage. Information may be difficult to interpret quickly and harder still to use in a preferred Indian language .

## The solution

The platform combines active CAP/SACHET-style alerts with an interactive India map and location-relevance engine. Its Past workspace retrieves recent Google News evidence, enforces citation and temporal checks, and produces an evidence bundle for comparison or AI-assisted research. The UI has a global locale layer so navigation, controls, status, map chrome, drawers, and accessibility text can change without changing disaster-data identifiers or official source records.

## Why it matters

- Accessibility: a language choice should transform a workflow, not just a header.
- Trust: official wording, alert IDs, URLs, geometry, timestamps, and citations remain traceable.
- Situational awareness: live map and proximity context help users interpret an alert’s relevance.
- Evidence: historical research stays linked to retrieved sources and stable `[S#]` citations.

## Key features

### Present — live situation

- Active official alert retrieval with ETag support and expiry filtering.
- Leaflet India map, stable alert geometry, category filters, and marker/legend UI.
- Browser location and custom location lookup, with polygon/circle/centroid relevance assessment.
- Alert detail drawer with official instructions, CAP metadata, protective measures, helplines, sharing, and official links.

### Past — historical research

- Google News-backed evidence retrieval with temporal gating and source de-duplication.
- Historical cards, filters, sorting, event details, report download, and 2–4 event comparison.
- Citation-backed AI research assistant plus browser/Groq-assisted speech flows when configured.

### Multilingual UI

- App-owned copy uses semantic keys with English fallback and interpolation.
- Hindi and Bengali have complete coverage for the core UI key set; other selectable locales safely fall back to English where dedicated copy has not yet been authored.
- Hazard category IDs remain canonical (`Flood`, `Cyclone`, etc.) while display labels are localized.
- Official CAP/SACHET text remains canonical source wording rather than being presented as an altered official translation.

## Architecture

```text
SACHET / CAP / telemetry ─┐
                           ├─> Express API ─> Alert parsing + relevance metadata
Google News ───────────────┤          │
                           │          ├─> Evidence / citation / temporal gate
Groq (optional) ───────────┘          └─> AI, transcription and TTS endpoints
                                                   │
                                                   v
                                         React + Leaflet frontend
                                                   │
                                     Global locale / semantic UI keys
                              ┌────────────┼─────────────┐
                              v            v             v
                           Present        Past        Assistant
```

## Project structure

```text
backend/
  server.ts                 HTTP server entry point
  server/app.ts             Express/CORS/static application
  server/routes.ts          API routes
  server/sachet.ts          CAP/SACHET and telemetry parsing
  server/googleNews.ts      Google News retrieval
  server/aiGateway.ts       Evidence, comparison, AI, STT and TTS
  server/lib/               translation, relevance and evidence helpers
  tests/                    relevance, temporal, citations and locale tests
frontend/
  src/App.tsx               application state and locale persistence
  src/types/language.ts     language metadata, UI copy and locale helpers
  src/components/present/   live map, location, alert and sharing workflow
  src/components/past/      archive, detail, comparison and assistant workflow
  src/lib/                  API, relevance and evidence helpers
```

## Data sources and trust model

| Source / output | Role | Trust treatment |
| --- | --- | --- |
| SACHET/CAP and telemetry | live alerts | authoritative fields and original wording are preserved |
| OpenStreetMap Nominatim | location lookup | resolves a user-entered place; it is not an alert authority |
| Google News RSS/search | research evidence | deduplicated and temporally gated before use |
| AI synthesis | research assistance | derived content, with citations retained where available |

This is a situational-awareness tool, not a replacement for emergency authorities. Follow official instructions and local emergency services during an active incident.

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/alerts` | active alerts with ETag support |
| GET | `/api/alerts/:id/news` | recent, temporally gated news for an alert |
| GET | `/api/geocode?q=` | Indian location lookup |
| POST | `/api/past/search` | build a historical evidence bundle |
| GET | `/api/past/archive` | recent evidence-backed archive |
| POST | `/api/past/compare` | compare 2–4 bundles |
| POST | `/api/past/chat` | research assistant |
| POST | `/api/transcribe` | speech transcription |
| POST | `/api/tts` | text-to-speech |
| GET | `/api/health` | service diagnostics |

## Setup

Requirements: Node.js 20+ and npm.

```bash
git clone <repository-url>
cd soham-lodh-sih-2026

cd backend
copy .env.example .env
npm install
npm run dev
```

In another terminal:

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

The frontend defaults to `http://localhost:5173`; configure `VITE_API_BASE_URL` to point to the backend when they are served separately.

## Environment variables

See [`backend/.env.example`](backend/.env.example). The backend reads `PORT`, `APP_URL`, `CORS_ORIGINS`, `FRONTEND_URL`, and optional Groq keys/model settings (`GROQ_API_KEY`, scoped `GROQ_API_KEY_*`, `GROQ_MODEL`, `GROQ_STT_MODEL`, `GROQ_TTS_MODEL`, `GROQ_TTS_VOICE`). The frontend uses `VITE_API_BASE_URL`.

Never commit real keys.

## Localization design

`App.tsx` owns the selected locale, persists it in `localStorage`, and updates the document language. `translate(locale, key, values)` resolves semantic application keys, interpolates structured values, and falls back to English. Map filter values and API parameters stay canonical; only their labels are translated. A locale switch does not re-fetch live alerts or reconstruct the Leaflet map.

External/official content is deliberately different: canonical alert and evidence fields are kept as supplied. The UI identifies these as source wording rather than suggesting that a machine-generated rendering is an official translation.

## Testing

```bash
cd frontend && npm run lint && npm run build
cd ../backend && npm run lint && npm test && npm run build
```

Backend tests cover citation validation, temporal gating, geospatial relevance, alert expiry, locale fallback/interpolation, and stable hazard identifiers. Frontend type-checking and production builds validate component integration.

## Demo flow

1. Open **Present** and allow location access (or search a location).
2. Select an alert on the India map and inspect the official source, CAP fields, guidance, and helplines.
3. Switch from English to Hindi or Bengali while the drawer is open.
4. Show that filters, legend, navigation, and drawer controls update without losing map state.
5. Open **Past**, search for an event, inspect sources, then add two events to Compare.
6. Open the AI assistant and ask an evidence question; inspect the source badges.

## Limitations and roadmap

**Current:** live source integration, map/relevance workflow, evidence-grounded research, and core locale infrastructure.

**In progress:** completion of authored UI dictionaries for every selectable Indian language and broader component-level localization coverage.

**Planned:** official multilingual feed preference when sources provide it, stronger end-to-end UI tests, and language-specific speech capability reporting.

## Team

Contributor details have not been specified in this repository. Add the SIH team roster and roles here.

## License

Licensed under the [MIT License](LICENSE).
