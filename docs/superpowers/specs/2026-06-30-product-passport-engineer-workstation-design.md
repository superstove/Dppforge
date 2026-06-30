# Product Passport Engineer Workstation Design

## Objective

Upgrade DPP Forge into a focused construction Product Passport Engineer workstation that demonstrates the responsibilities in the Origentity job description. The product remains separate from ConstructAsk and does not attempt to reproduce the full Origentity platform.

## Scope

The implementation covers six job-aligned workflows:

1. Multi-document product evidence ingestion and AI extraction.
2. Comparable construction-product data and QR-ready Product/Batch records.
3. Manufacturer outreach, claim, upload, and approval workflows.
4. Independent target-market coverage for construction and road construction.
5. QA/QC linkage, document validity, labels, and exports.
6. Field-level evidence, rights, confidence, and audit controls.

## Document Ingestion

### Supported evidence types

- Technical Data Sheet (TDS)
- Environmental Product Declaration (EPD)
- Declaration of Performance / CE declaration (DoP)
- Laboratory test report or certificate
- Safety Data Sheet (SDS)
- Factory Production Control certificate (FPC)
- Quality, environmental, and occupational certificates
- Installation, application, maintenance, warranty, recycling, and end-of-life instructions
- Product catalogue or other supporting product document

PDF is the primary extraction format. CSV, XLSX, and JSON remain structured import formats. Every uploaded source receives a type, title, issuer, revision, issue date, expiry date, file name, rights status, and review status.

### Product boundaries

One source may contain multiple products. AI classification must return a product count and product sections before extraction. Each detected product becomes a separate draft. The system must never silently combine fields from different products. Ambiguous identity blocks approval until the reviewer assigns the source to a product.

### Multi-document merge

Documents assigned to the same product contribute evidence to one draft DPP. Conflicting values remain visible as conflicts; they are not overwritten automatically. The reviewer selects the authoritative value and the decision is recorded in the audit trail.

## DPP Data Model

### Identity

- Passport ID and version
- Product name, model, SKU, GTIN, manufacturer, brand, category, and description
- Product, batch, lot, and serial identifiers
- Country of origin, factory, production date, quantity, and unit of measure
- Market availability and intended applications

### Engineering properties

Every property stores a normalized name, raw value, normalized value, unit, tolerance/min/max, test method, standard, conditions, source citation, and confidence. Category templates define expected properties without preventing additional extracted fields.

### Compliance and sustainability

- Standards and regulatory references with market/region
- Certificate and declaration identifiers, issuers, validity, and expiry
- CE/DoP, AVCP, notified body, and declared performance fields
- EPD program operator, declaration number, declared unit, modules, and LCA indicators
- Material composition, hazardous-substance declarations, recycled content, carbon data, recyclability, repair, reuse, recycling, and disposal instructions

### Supply chain and QA/QC

- Supplier and factory references
- Packaging, storage, shelf life, transport, installation, maintenance, and warranty
- Batch QA/QC status, tests, results, inspector, date, attachments, and disposition
- Product Master QR plus optional Batch/Serial QR envelope
- Label payload and printing status

## Evidence, Rights, And Quality

Each important field has one or more evidence records containing source document ID, page/section citation, quoted context, extraction method, AI confidence, reviewer status, reviewer, and review timestamp.

Original AI confidence is immutable. Human review is stored separately and never rewrites the AI score. Publication requires:

- Product identity resolved
- Required category fields reviewed
- Overall reviewed confidence at least 90%
- Evidence citation for required fields
- Rights status permitting the intended use
- No unresolved critical conflicts
- Explicit reviewer approval

Audit events cover upload, extraction, edit, conflict resolution, approval, rejection, publication, manufacturer claim, and document replacement.

## Manufacturer Cooperation

The existing manufacturer CRM is extended with:

- Target, engaged, onboarded, and active stages
- Email, phone, and video outreach templates
- Contact and activity timeline
- Claim profile submission
- Secure document-request and upload records
- Manufacturer verification, approval, rejection, and revision request
- Authority status per product and source document

The initial portfolio implementation records communications and generates templates. It does not send real email or place calls without a configured provider.

## Market Coverage

Coverage is based on a maintained target catalogue, not only saved passports. A target entry contains sector, category, subcategory, region, key products, required document types, standards, certifications, and priority.

Coverage compares targets against approved passports and reports:

- Product/category/document/standard coverage
- Missing evidence and certifications
- Manufacturer engagement status
- Average reviewed confidence
- Construction and road-construction filters

Expert validation status is shown for every rule mapping so hardcoded mappings are never presented as externally certified truth.

## User Experience

### Upload

Users select Auto Detect or a known document type, upload one or more files, and see detected products and document classifications. Extraction failures remain on the upload screen with a retryable message.

### Review and approval

The review page separates AI confidence from human review. Users edit identity, properties, standards, lifecycle, and QA/QC data; inspect citations; resolve conflicts; and approve only when publication gates pass.

### Manufacturer portal

A claim/request view allows a manufacturer record to submit product identity, supporting documents, permissions, and approval decisions. The CRM shows the latest claim and missing requirements.

### QR and exports

Approved passports generate public Product QR JSON and optional Batch QR JSON. Exports include JSON, CSV/XLSX, aligned PDF, and IFC where applicable.

## API And Storage

New normalized entities are introduced for source documents, field evidence, product targets, QA/QC records, and manufacturer claims/uploads. Existing DPP JSON remains the portable envelope and is extended compatibly. Database migrations are additive so existing saved passports continue to load.

Backend endpoints enforce approval and publication gates. Frontend-only confidence manipulation is not trusted. Public endpoints expose approved data only and omit internal rights notes, private contacts, and review comments.

## Error Handling

- Reject unsupported or unreadable files with actionable messages.
- Keep AI provider failures retryable and do not create misleading zero-confidence drafts.
- Flag multi-product and conflicting-source cases for review.
- Preserve uploaded source metadata when extraction fails.
- Prevent duplicate passport, batch, certificate, and document identifiers.
- Surface expired or soon-to-expire evidence without silently deleting it.

## Testing

- Unit tests for document classification, normalization, confidence, conflicts, rights, and publication gates.
- API tests for multi-document merge, manufacturer claims, QA/QC, market targets, and public QR responses.
- Regression tests for page-marker identity, provider fallback, deletion, URLs, and PDF export.
- Frontend type checking and production build.
- Responsive browser checks for upload, review, CRM, market coverage, and QR views.

## Delivery Order

1. Strengthen the DPP schema and server-side approval model.
2. Add document registry, auto classification, and multi-product safeguards.
3. Complete review/evidence/conflict editing.
4. Add QA/QC and Product/Batch QR envelopes.
5. Complete manufacturer claim/upload workflow.
6. Expand independent market coverage and expert-validation status.
7. Update exports, README, sample data, and presentation screenshots.

## Out Of Scope

- Rebuilding Origentity's full production platform
- Real telephony or video infrastructure
- Legal certification of compliance mappings
- Blockchain or external trust registry
- Full logistics ERP, procurement, or warehouse management
