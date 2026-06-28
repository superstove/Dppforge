# DPP Forge

Construction-native Digital Product Passport tooling for turning manufacturer documents into QR-ready product records.

## What It Does

- Converts TDS, EPD, DoP/CE, and test report PDFs into structured DPP JSON.
- Supports manual entry, batch PDF upload, CSV/XLSX import, human review, and QR generation.
- Stores passports with source metadata, field evidence, data-rights status, confidence scores, and audit trail.
- Enforces a 90% minimum confidence threshold before a passport can be saved.
- Tracks manufacturer outreach and claim profiles through a simple CRM pipeline.
- Maps target market coverage across construction and road-construction product categories.
- Runs operational ESPR/CPR checks, GS1 Digital Link generation, GWP calculation, registry export, PDF export, and IFC export.

## Core Workflows

1. Upload or manually enter manufacturer product data.
2. Review extracted properties, units, standards, evidence, and confidence.
3. Confirm manufacturer rights and claim-profile status.
4. Save the DPP only when the record reaches at least 90% confidence.
5. Generate QR codes for the public passport and ConstructAsk integration.
6. Use dashboard, market coverage, compliance, and CRM views to maintain the passport estate.

## Local Setup

Backend:

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8001
```

Frontend:

```bash
npm install
npm run dev
```

Useful environment variables:

- `DATABASE_URL`: PostgreSQL or SQLite database URL.
- `PUBLIC_APP_URL`: public frontend URL used in QR verification links.
- `CONSTRUCTASK_URL`: ConstructAsk verification URL.
- `TDS_OPENAI_API_KEY`: optional OpenAI extraction key.
- `TDS_GEMINI_API_KEY`: optional Gemini extraction key.
- `DPP_API_KEY`: optional API key requirement for `/api/*` endpoints.
- `CORS_ORIGINS`: comma-separated allowed frontend origins.

## Verification

```bash
python -m pytest backend/tests
npm run lint
npm run build
```

## Compliance Note

The ESPR/CPR rulebook is an operational checklist, not legal certification. Standards mappings, GWP benchmarks, and category triggers must be reviewed by qualified civil/materials/compliance experts before authority-grade or regulatory use.
