# Product Passport Engineer Workstation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the missing job-description workflows into DPP Forge while preserving existing passports and keeping ConstructAsk separate.

**Architecture:** Extend the portable DPP JSON envelope and add normalized source-document, QA/QC, and target-market tables. Enforce publication rules in FastAPI, then expose focused React editing surfaces through existing Upload, Review, Manufacturers, Market Coverage, and Passport views.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy, PostgreSQL/SQLite, PyMuPDF, Gemini, React 19, TypeScript, Vite, Tailwind CSS, qrcode, ReportLab.

---

## File Map

- `backend/models.py`: persistent source documents, QA/QC records, and market targets.
- `backend/routes/converter.py`: document classification, extraction, DPP assembly, and publication approval.
- `backend/routes/passports.py`: approved passport detail, Batch QR, labels, and exports.
- `backend/routes/manufacturers.py`: claims, document requests/uploads, and authority review.
- `backend/routes/analytics.py`: target-driven market coverage.
- `backend/main.py`: additive database migrations.
- `src/types.ts`: shared frontend contracts.
- `src/api.ts`: API methods for new workflows.
- `src/views/UploadView.tsx`: auto-detect and supported evidence types.
- `src/views/ReviewView.tsx`: AI versus human confidence, citations, lifecycle, and approval gates.
- `src/views/PassportsView.tsx`: QA/QC and Product/Batch QR actions.
- `src/views/ManufacturersView.tsx`: claim/upload/approval workflow.
- `src/views/MarketCoverageView.tsx`: independent targets and missing requirements.
- `backend/tests/test_converter.py`: integration coverage for the new behavior.
- `README.md`: portfolio-ready setup, architecture, workflows, limitations, and screenshots.

### Task 1: Server-Side Review And Publication Model

**Files:**
- Modify: `backend/routes/converter.py`
- Modify: `backend/tests/test_converter.py`
- Modify: `src/types.ts`
- Modify: `src/views/ReviewView.tsx`

- [ ] **Step 1: Write failing approval-policy tests**

Add tests proving AI confidence remains unchanged and approval requires reviewer metadata, rights, citations, and no critical conflicts:

```python
def test_approval_preserves_ai_confidence_and_records_human_review():
    dpp = _manual_dpp()
    dpp["confidence"]["overall"] = 72
    res = client.post("/api/convert/approve", json={
        "dpp_json": dpp,
        "reviewer": "Product Passport Engineer",
        "reviewed_confidence": 95,
        "rights_status": "manufacturer_authorized",
    })
    assert res.status_code == 200
    approved = res.json()["dpp_json"]
    assert approved["confidence"]["overall"] == 72
    assert approved["review"]["reviewed_confidence"] == 95
    assert approved["review"]["status"] == "approved"

def test_approval_rejects_missing_required_citations():
    dpp = _manual_dpp()
    dpp["evidence"]["field_sources"] = []
    res = client.post("/api/convert/approve", json={
        "dpp_json": dpp, "reviewer": "Reviewer",
        "reviewed_confidence": 95,
        "rights_status": "manufacturer_authorized",
    })
    assert res.status_code == 422
```

- [ ] **Step 2: Run the tests and confirm RED**

Run: `python -m pytest backend/tests/test_converter.py -q -k approval_`

Expected: FAIL because `/api/convert/approve` does not exist.

- [ ] **Step 3: Add approval contracts and publication gate**

Add `ApprovalInput`, `publication_issues(dpp, payload)`, and `/approve`. Store review separately:

```python
class ApprovalInput(BaseModel):
    dpp_json: dict
    reviewer: str
    reviewed_confidence: float = Field(ge=0, le=100)
    rights_status: str
    notes: str = ""

@router.post("/approve")
def approve_dpp(payload: ApprovalInput):
    issues = publication_issues(payload.dpp_json, payload)
    if issues:
        raise HTTPException(422, detail={"message": "Approval requirements not met", "issues": issues})
    dpp = deepcopy(payload.dpp_json)
    dpp["review"] = {
        "status": "approved",
        "reviewer": payload.reviewer.strip(),
        "reviewed_confidence": payload.reviewed_confidence,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "notes": payload.notes,
    }
    dpp["data_rights"]["permission_status"] = payload.rights_status
    dpp.setdefault("audit_trail", []).append({
        "event": "human_review_approved", "actor": payload.reviewer,
        "method": "server_approval", "timestamp": dpp["review"]["reviewed_at"],
    })
    return {"status": "approved", "dpp_json": dpp}
```

Update `/save` to require `review.status == "approved"` for AI-extracted records and use reviewed confidence for the 90% gate without overwriting AI confidence.

- [ ] **Step 4: Update frontend review contracts and flow**

Add `review`, `conflicts`, and evidence review fields to `DppJson`. Replace frontend confidence mutation with `api.approveDpp(...)`, then pass the server-approved envelope to `saveDpp`.

- [ ] **Step 5: Verify and commit**

Run: `python -m pytest backend/tests -q`, `npm.cmd run lint`, `npm.cmd run build`

Expected: all pass.

Commit: `git commit -m "Enforce server-side DPP review and publication gates"`

### Task 2: Multi-Document Classification And Product Boundaries

**Files:**
- Modify: `backend/routes/converter.py`
- Modify: `backend/tests/test_converter.py`
- Modify: `src/views/UploadView.tsx`
- Modify: `src/types.ts`

- [ ] **Step 1: Write failing classification tests**

```python
def test_document_classifier_detects_supported_types():
    assert classify_document("Safety Data Sheet SECTION 2 Hazards")["document_type"] == "sds"
    assert classify_document("Declaration of Performance AVCP notified body")["document_type"] == "dop"

def test_multi_product_document_returns_separate_drafts(monkeypatch):
    monkeypatch.setattr(converter, "ai_extract_product_drafts", lambda *_: [
        _fields("Product A", "Maker A"), _fields("Product B", "Maker B")
    ])
    res = _upload_pdf("Product A\nProduct B")
    assert res.status_code == 200
    assert len(res.json()["drafts"]) == 2
```

- [ ] **Step 2: Run and confirm RED**

Run: `python -m pytest backend/tests/test_converter.py -q -k "classifier or multi_product"`

- [ ] **Step 3: Add supported types and auto classification**

Expand `DOC_PROMPTS` with `auto`, `sds`, `fpc`, `certificate`, `installation`, `maintenance`, `warranty`, `end_of_life`, and `catalogue`. Implement deterministic keyword classification plus an AI product-boundary prompt returning:

```json
{
  "document_type": "tds",
  "products": [
    {"product_name": "...", "manufacturer": "...", "start_page": 1, "end_page": 2}
  ]
}
```

Build one DPP draft per product and return `drafts`, `detected_document_type`, and `product_count`. Preserve `extracted_dpp` for single-product backward compatibility.

- [ ] **Step 4: Update Upload UI**

Make `Auto Detect` the default segmented option. Add the supported evidence types and render a draft chooser when `drafts.length > 1`; each choice opens Review independently.

- [ ] **Step 5: Verify and commit**

Run backend tests, lint, and build. Commit: `git commit -m "Support auto-classified multi-product evidence uploads"`

### Task 3: Source Document Registry And Field Evidence

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/main.py`
- Modify: `backend/routes/converter.py`
- Modify: `backend/tests/test_converter.py`
- Modify: `src/types.ts`
- Modify: `src/views/ReviewView.tsx`

- [ ] **Step 1: Write failing source registry tests**

Test that upload metadata includes document ID, issuer, revision, dates, rights, page citation, quote, immutable AI confidence, and review status.

- [ ] **Step 2: Run and confirm RED**

Run: `python -m pytest backend/tests/test_converter.py -q -k source_document_registry`

- [ ] **Step 3: Add normalized models and additive migrations**

Create `SourceDocument` and `FieldEvidence`:

```python
class SourceDocument(Base):
    __tablename__ = "source_documents"
    id = Column(Integer, primary_key=True)
    passport_id = Column(String, index=True)
    document_type = Column(String, index=True)
    title = Column(String)
    issuer = Column(String)
    revision = Column(String)
    issue_date = Column(String)
    expiry_date = Column(String)
    file_name = Column(String)
    rights_status = Column(String, default="internal_review")
    review_status = Column(String, default="pending")
    metadata_json = Column(Text, default="{}")
```

`FieldEvidence` stores field path, source ID, page, section, quote, extraction method, AI confidence, reviewer status, reviewer, and reviewed time. Use `Base.metadata.create_all` for new tables and retain existing migration behavior.

- [ ] **Step 4: Populate and edit evidence**

Extraction prompt returns `_citation` objects for identity, standards, and properties. Review renders citations beside fields and provides reviewed/pending controls without changing AI confidence.

- [ ] **Step 5: Verify and commit**

Run all checks. Commit: `git commit -m "Add source document registry and field evidence review"`

### Task 4: Product, Batch, QA/QC, Label, And QR Envelopes

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/routes/passports.py`
- Modify: `backend/main.py`
- Modify: `backend/tests/test_converter.py`
- Modify: `src/api.ts`
- Modify: `src/types.ts`
- Modify: `src/views/PassportsView.tsx`

- [ ] **Step 1: Write failing QA and Batch QR tests**

```python
def test_batch_qr_contains_product_and_quality_links():
    record_id = _save_approved_passport()
    qa = client.post(f"/api/passports/{record_id}/quality-records", json={
        "batch_number": "B-100", "status": "passed", "tested_by": "QA Engineer",
        "test_date": "2026-06-30", "results": [{"property": "strength", "value": 40, "unit": "MPa"}],
    })
    assert qa.status_code == 201
    envelope = client.get(f"/api/passports/{record_id}/batch/B-100").json()
    assert envelope["qr_level"] == "batch"
    assert envelope["quality_status"] == "passed"
```

- [ ] **Step 2: Run and confirm RED**

- [ ] **Step 3: Add `QualityRecord` model and endpoints**

Store passport, batch/lot/serial, status, tests/results JSON, inspector, date, attachments, notes, and disposition. Add create/list endpoints, Batch envelope JSON, Batch QR PNG, and print-label PDF.

- [ ] **Step 4: Add passport UI actions**

In passport detail, add tabs for Product, Batch/Serial, QA/QC, and Documents. Provide create QA record, generate Batch QR, and label download commands.

- [ ] **Step 5: Verify and commit**

Run all checks. Commit: `git commit -m "Link QA records and batch QR envelopes"`

### Task 5: Manufacturer Claims, Requests, Uploads, And Authority

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/routes/manufacturers.py`
- Modify: `backend/tests/test_converter.py`
- Modify: `src/api.ts`
- Modify: `src/types.ts`
- Modify: `src/views/ManufacturersView.tsx`

- [ ] **Step 1: Write failing claim workflow tests**

Test target → engaged → onboarded → active transitions, document request creation, manufacturer upload metadata, claim revision request, approval, and authority assignment.

- [ ] **Step 2: Run and confirm RED**

- [ ] **Step 3: Extend claim persistence and API**

Add requested document types, permissions, submitted documents, reviewer notes, authority scope, reviewed by/at, and revision number. Add endpoints for requests, upload metadata, submit, approve, reject, and request revision.

- [ ] **Step 4: Complete CRM UI**

Render pipeline controls, outreach templates, activity timeline, requested/missing documents, claim state, and approval controls. Keep communications as generated/recorded activities unless a provider is configured.

- [ ] **Step 5: Verify and commit**

Run all checks. Commit: `git commit -m "Complete manufacturer claim and evidence workflow"`

### Task 6: Independent Target Market Coverage

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/routes/analytics.py`
- Modify: `backend/main.py`
- Modify: `backend/tests/test_converter.py`
- Modify: `src/api.ts`
- Modify: `src/types.ts`
- Modify: `src/views/MarketCoverageView.tsx`

- [ ] **Step 1: Write failing target coverage tests**

Seed road-construction targets with required TDS/DoP/EPD/test documents and EN/ASTM/ISO/BS/IS mappings. Assert coverage reports missing products and evidence even when no passport exists.

- [ ] **Step 2: Run and confirm RED**

- [ ] **Step 3: Add `MarketTarget` and target-driven calculations**

Store sector, category, subcategory, region, target product, required documents, standards, certificates, priority, and expert-validation status. Compare approved passport evidence against targets and return covered, partial, missing, and unvalidated mappings.

- [ ] **Step 4: Upgrade Market Coverage UI**

Add construction/road filters, region selector, target table, required evidence, missing requirements, manufacturer stage, reviewed confidence, and expert-validation badge.

- [ ] **Step 5: Verify and commit**

Run all checks. Commit: `git commit -m "Make market coverage target driven"`

### Task 7: Lifecycle Fields, Exports, README, And Browser Verification

**Files:**
- Modify: `backend/routes/converter.py`
- Modify: `backend/routes/passports.py`
- Modify: `backend/tests/test_converter.py`
- Modify: `src/types.ts`
- Modify: `src/views/ReviewView.tsx`
- Modify: `src/views/PublicPassportView.tsx`
- Modify: `README.md`
- Update: `assets/screenshot-upload.png`
- Update: `assets/screenshot-passport.png`
- Update: `assets/screenshot-dashboard.png`

- [ ] **Step 1: Write failing lifecycle and export tests**

Test packaging, transport, installation, maintenance, warranty, repair, reuse, recycling, disposal, composition, hazards, certificate expiry, aligned PDF sections, and IFC property export.

- [ ] **Step 2: Run and confirm RED**

- [ ] **Step 3: Extend DPP envelope and exports**

Add `identifiers`, `manufacturing`, `supply_chain`, `health_safety`, and `lifecycle` sections. Render non-empty fields in public JSON/PDF and export reviewed engineering values to IFC properties.

- [ ] **Step 4: Make README presentation-ready**

Replace generic AI Studio text with product purpose, architecture, supported documents, approval policy, setup, Render/Vercel configuration, API examples, limitations, security note, and job-description feature map.

- [ ] **Step 5: Run complete verification**

Run:

```powershell
python -m pytest backend\tests -q
npm.cmd run lint
npm.cmd run build
```

Start the local app and verify desktop (1440x900), tablet (768x1024), and mobile (390x844) for Upload, Review, Passport, Manufacturers, and Market Coverage. Confirm no overlap, hidden navigation, blank states, localhost QR URLs, or inaccessible controls.

- [ ] **Step 6: Capture current screenshots and commit**

Commit: `git commit -m "Finish Product Passport Engineer workstation"`

## Final Acceptance

- Every job-description responsibility has a visible, testable workflow.
- AI confidence and human-reviewed confidence remain separate.
- A failed AI request never creates a misleading publishable passport.
- Multiple products never merge silently.
- Product and Batch QR scans resolve to public approved JSON.
- Target market gaps exist independently of saved passports.
- Manufacturer claims and evidence have explicit approval history.
- All backend tests, TypeScript checks, production build, and responsive browser checks pass.
