import type { ReactNode } from 'react';
import { useState, useEffect, useRef } from 'react';
import {
  FileText, QrCode, Shield, Factory, BarChart3, Globe, Database,
  ChevronDown, ChevronRight, Zap, CheckCircle, Layers,
  FileSearch, Brain, ClipboardCheck, BookOpen, ArrowDown,
  Upload, Eye, Sparkles, Clock, Target, TrendingUp, Award,
} from 'lucide-react';

/* ─── Animated intro hero ─── */
function IntroHero({ onScrollDown }: { onScrollDown: () => void }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timers = [
      setTimeout(() => setStep(1), 600),
      setTimeout(() => setStep(2), 1400),
      setTimeout(() => setStep(3), 2200),
      setTimeout(() => setStep(4), 3000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="relative min-h-[80vh] flex flex-col items-center justify-center text-center px-4 mb-16 overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[90vw] h-[60vh] bg-blue-500/8 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[40%] w-[50vw] h-[40vh] bg-purple-500/6 blur-[120px] rounded-full" style={{ animationDelay: '1s', animationDuration: '4s' }} />
      </div>

      {/* Main title */}
      <div
        className="relative z-10 transition-all duration-1000 ease-out"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(40px)',
        }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[#8b8fa3] text-sm mb-6">
          <Sparkles className="w-4 h-4 text-blue-400" />
          Product Tutorial & Guide
        </div>

        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-[#6b7280] leading-none mb-6">
          DPP Forge
        </h1>
        <p className="text-xl sm:text-2xl text-[#8b8fa3] font-light max-w-2xl mx-auto leading-relaxed mb-12">
          Transform construction product documentation into
          <span className="text-white font-medium"> verified Digital Product Passports </span>
          with AI-powered extraction
        </p>
      </div>

      {/* Animated flow diagram */}
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-14">
        <FlowStep icon={<Upload className="w-5 h-5" />} label="Upload PDF" active={step >= 1} delay={0} />
        <FlowArrow active={step >= 2} />
        <FlowStep icon={<Brain className="w-5 h-5" />} label="AI Extracts" active={step >= 2} delay={100} />
        <FlowArrow active={step >= 3} />
        <FlowStep icon={<Eye className="w-5 h-5" />} label="Review & Edit" active={step >= 3} delay={200} />
        <FlowArrow active={step >= 4} />
        <FlowStep icon={<QrCode className="w-5 h-5" />} label="DPP + QR" active={step >= 4} delay={300} />
      </div>

      {/* Key numbers */}
      <div
        className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 max-w-3xl w-full mb-12 transition-all duration-700"
        style={{ opacity: step >= 4 ? 1 : 0, transform: step >= 4 ? 'translateY(0)' : 'translateY(20px)' }}
      >
        <StatCard icon={<Clock className="w-4 h-4" />} value="< 5 min" label="per passport" />
        <StatCard icon={<Layers className="w-4 h-4" />} value="4" label="doc types" />
        <StatCard icon={<Brain className="w-4 h-4" />} value="3-tier" label="AI pipeline" />
        <StatCard icon={<Shield className="w-4 h-4" />} value="EU" label="ESPR ready" />
      </div>

      {/* Scroll indicator */}
      <button
        onClick={onScrollDown}
        className="relative z-10 flex flex-col items-center gap-2 text-[#63677a] hover:text-white transition-colors animate-bounce"
      >
        <span className="text-sm">Explore the platform</span>
        <ArrowDown className="w-5 h-5" />
      </button>
    </div>
  );
}

function FlowStep({ icon, label, active, delay }: { icon: ReactNode; label: string; active: boolean; delay: number }) {
  return (
    <div
      className="flex flex-col items-center gap-2 transition-all duration-500"
      style={{
        opacity: active ? 1 : 0.2,
        transform: active ? 'scale(1)' : 'scale(0.9)',
        transitionDelay: `${delay}ms`,
      }}
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-500 ${
        active ? 'bg-white text-black border-white shadow-lg shadow-white/20' : 'bg-[#1a1d27] text-[#63677a] border-[#2e3245]'
      }`}>
        {icon}
      </div>
      <span className={`text-xs font-medium transition-colors duration-500 ${active ? 'text-white' : 'text-[#63677a]'}`}>{label}</span>
    </div>
  );
}

function FlowArrow({ active }: { active: boolean }) {
  return (
    <div className={`hidden sm:block transition-all duration-500 ${active ? 'text-white/60' : 'text-[#2e3245]'}`}>
      <svg width="32" height="12" viewBox="0 0 32 12" fill="none">
        <path d="M0 6h28m0 0l-5-5m5 5l-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function StatCard({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="bg-[#1a1d27]/60 backdrop-blur-sm border border-[#2e3245] rounded-xl p-4 text-center">
      <div className="flex items-center justify-center gap-1.5 text-blue-400 mb-1">{icon}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-[#63677a]">{label}</div>
    </div>
  );
}

/* ─── Feature showcase cards ─── */
const FEATURES = [
  {
    icon: Upload,
    color: 'blue',
    title: 'Smart Document Upload',
    desc: 'Drop any TDS, EPD, DoP, or Test Report PDF. The system detects multi-column layouts, tables, and scanned pages automatically.',
    tags: ['PDF parsing', 'PyMuPDF', '4 doc types'],
  },
  {
    icon: Brain,
    color: 'purple',
    title: 'Multi-Model AI Extraction',
    desc: 'A 3-tier pipeline: Gemini (primary) → OpenAI (fallback) → regex (baseline). Each returns per-field confidence scores so you know exactly what to verify.',
    tags: ['Gemini', 'OpenAI', 'Confidence scoring'],
  },
  {
    icon: Layers,
    color: 'emerald',
    title: 'Structured DPP JSON',
    desc: 'Output follows a strict schema: product identity, technical & working properties with units, standards compliance, sustainability metrics, batch info, and QR links.',
    tags: ['EU ESPR', 'Machine-readable', 'Standards mapping'],
  },
  {
    icon: QrCode,
    color: 'amber',
    title: 'Dual QR Verification',
    desc: 'Two QR codes per passport: a self-hosted DPP Forge verification page and a ConstructAsk integration QR. Both stored as binary PNGs in the database.',
    tags: ['Public verification', 'ConstructAsk', 'Instant access'],
  },
  {
    icon: Factory,
    color: 'rose',
    title: 'Manufacturer CRM',
    desc: 'Built-in 4-stage pipeline: Target → Engaged → Onboarded → Active. Log emails, calls, meetings. Every stage change auto-logged with timestamps.',
    tags: ['Pipeline tracking', 'Activity log', 'Contact management'],
  },
  {
    icon: BarChart3,
    color: 'cyan',
    title: 'Analytics & Market Coverage',
    desc: 'Real-time KPI dashboard with passport counts, confidence trends, CRM pipeline charts, and per-category market coverage with standards breakdowns.',
    tags: ['KPIs', 'Category analysis', 'Pipeline charts'],
  },
];

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; tagBg: string }> = {
  blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    text: 'text-blue-400',    tagBg: 'bg-blue-500/10 text-blue-300' },
  purple:  { bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  text: 'text-purple-400',  tagBg: 'bg-purple-500/10 text-purple-300' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', tagBg: 'bg-emerald-500/10 text-emerald-300' },
  amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   text: 'text-amber-400',   tagBg: 'bg-amber-500/10 text-amber-300' },
  rose:    { bg: 'bg-rose-500/10',    border: 'border-rose-500/20',    text: 'text-rose-400',    tagBg: 'bg-rose-500/10 text-rose-300' },
  cyan:    { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20',    text: 'text-cyan-400',    tagBg: 'bg-cyan-500/10 text-cyan-300' },
};

function FeatureCard({ feature, ...rest }: { feature: typeof FEATURES[0]; key?: string }) {
  const Icon = feature.icon;
  const c = COLOR_MAP[feature.color];
  return (
    <div className="bg-[#1a1d27] border border-[#2e3245] rounded-2xl p-6 hover:border-[#3e4255] transition-all group">
      <div className={`w-12 h-12 rounded-xl ${c.bg} ${c.border} border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        <Icon className={`w-5 h-5 ${c.text}`} />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
      <p className="text-sm text-[#a0a8bf] leading-relaxed mb-4">{feature.desc}</p>
      <div className="flex flex-wrap gap-2">
        {feature.tags.map(tag => (
          <span key={tag} className={`text-xs px-2.5 py-1 rounded-full ${c.tagBg}`}>{tag}</span>
        ))}
      </div>
    </div>
  );
}

/* ─── How it works (interactive stepper) ─── */
const STEPS = [
  {
    num: 1,
    title: 'Upload your document',
    desc: 'Select the document type (TDS, EPD, DoP, or Test Report) and drop your PDF. DPP Forge uses PyMuPDF to extract text intelligently — handling multi-column layouts, tables, and manufacturer-specific formats. Scanned pages are detected and flagged.',
    icon: Upload,
  },
  {
    num: 2,
    title: 'AI extracts & maps fields',
    desc: 'The extracted text is sent to a document-type-specific AI prompt. For TDS: technical & working properties. For EPD: LCA indicators (GWP, ODP, AP). For DoP: CE marking and AVCP data. Each field gets a confidence score (0-100%).',
    icon: Brain,
  },
  {
    num: 3,
    title: 'Review with confidence scoring',
    desc: 'The assembled DPP JSON is presented for human review. Low-confidence fields are visually flagged with color-coded badges. Edit product name, manufacturer, category, batch number, and any extracted field before saving.',
    icon: Eye,
  },
  {
    num: 4,
    title: 'Generate QR & save passport',
    desc: 'Approve the passport and two QR codes are generated instantly. The DPP is stored in the database with full metadata: source document, extraction method, confidence details, and verification URLs embedded in the JSON.',
    icon: QrCode,
  },
  {
    num: 5,
    title: 'Verify & share anywhere',
    desc: 'Anyone can scan the QR code to see the full verified passport — no login required. Product identity, all properties with units and test methods, standards, sustainability data, and source traceability in one view.',
    icon: Shield,
  },
];

function StepperSection() {
  const [activeStep, setActiveStep] = useState(0);
  const ActiveIcon = STEPS[activeStep].icon;

  return (
    <div className="mb-20">
      <SectionHeader icon={<Zap className="w-5 h-5" />} title="How It Works" subtitle="From PDF to verified Digital Product Passport in 5 steps" />

      <div className="grid md:grid-cols-[280px_1fr] gap-6 mt-8">
        {/* Step list */}
        <div className="space-y-2">
          {STEPS.map((step, i) => {
            const StepIcon = step.icon;
            return (
              <button
                key={i}
                onClick={() => setActiveStep(i)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all ${
                  activeStep === i
                    ? 'bg-white/10 border border-white/20'
                    : 'bg-transparent border border-transparent hover:bg-[#1a1d27]'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                  activeStep === i ? 'bg-white text-black' : 'bg-[#242736] text-[#63677a]'
                }`}>
                  <span className="text-sm font-bold">{step.num}</span>
                </div>
                <span className={`text-sm font-medium transition-colors ${activeStep === i ? 'text-white' : 'text-[#8b8fa3]'}`}>
                  {step.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active step detail */}
        <div className="bg-[#1a1d27] border border-[#2e3245] rounded-2xl p-8 min-h-[240px] flex flex-col justify-center">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-white text-black flex items-center justify-center">
              <ActiveIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-[#63677a] font-medium mb-1">Step {STEPS[activeStep].num} of {STEPS.length}</div>
              <h3 className="text-xl font-semibold text-white">{STEPS[activeStep].title}</h3>
            </div>
          </div>
          <p className="text-[#a0a8bf] leading-relaxed">{STEPS[activeStep].desc}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Deep-dive accordion ─── */
const DEEP_SECTIONS = [
  {
    id: 'glossary',
    icon: BookOpen,
    title: 'Key Terms Explained (For Beginners)',
    content: `New to Digital Product Passports? Here's what every term means in plain language:

**DPP (Digital Product Passport)** — A structured digital record containing everything about a construction product: what it is, who made it, how it performs, what standards it meets, and its environmental impact. Think of it as an "identity card" for a building material.

**TDS (Technical Data Sheet)** — A document from the manufacturer listing product properties like strength, density, and usage instructions. It's the most common source for creating a DPP.

**EPD (Environmental Product Declaration)** — A standardized report showing the environmental footprint of a product — carbon emissions, energy use, waste generated. Used for green building certifications.

**DoP (Declaration of Performance)** — A legal document required for CE-marked products in Europe, declaring how the product performs against specific standards.

**Confidence Score** — A percentage (0-100%) showing how certain the AI is about each extracted value. 95% means very reliable; below 70% means you should double-check the value manually.

**QR Code** — A scannable barcode printed on packaging or documentation. Anyone can scan it with their phone to instantly see the full verified passport — no app needed.

**Standards Compliance** — References to official standards the product meets (e.g., IS 12269 for cement, EN 13249 for geotextiles). These prove the product was tested and certified.

**Batch Number** — A unique code identifying a specific production run. Important for traceability — if a problem is found, the batch number helps identify which products are affected.

**OCR (Optical Character Recognition)** — Technology that reads text from scanned images. If a PDF is a photo/scan rather than digital text, OCR converts the image to readable text so AI can process it.

**CRM (Customer Relationship Management)** — A system for tracking manufacturer relationships. In DPP Forge, it tracks which manufacturers you're working with to get their products digitized.

**Market Coverage** — An analytics view that shows which product categories (cement, steel, adhesives, etc.) already have digital passports, helping you identify gaps and plan your work.

**ESPR** — The EU Ecodesign for Sustainable Products Regulation. This is the law driving the DPP requirement. Products sold in the EU will need machine-readable digital passports.

**LCA (Life Cycle Assessment)** — An analysis of environmental impact across a product's entire life — from raw material extraction through manufacturing, use, and disposal/recycling.

**BIM (Building Information Modeling)** — A 3D model-based process for planning, designing, and managing buildings and infrastructure. BIM software (like Revit or ArchiCAD) uses digital models that contain real product data — dimensions, materials, performance specs.

**IFC (Industry Foundation Classes)** — An open file format (.ifc) used to exchange BIM data between different software tools. DPP Forge can export passports as IFC files so product properties flow directly into BIM models without manual re-entry.`,
  },
  {
    id: 'why',
    icon: Shield,
    title: 'Why Digital Product Passports Matter',
    content: `The European Union's Digital Product Passport regulation (part of the Ecodesign for Sustainable Products Regulation - ESPR) requires manufacturers to provide machine-readable product data for transparency, sustainability, and circular economy goals.

**Regulatory Compliance** — EU regulations mandate that construction products must have accessible digital records containing performance data, environmental declarations, and CE marking information. Non-compliance restricts EU market access.

**Supply Chain Transparency** — Architects, engineers, contractors, and building owners get instant access to verified product specs. A DPP is the single source of truth through the product lifecycle.

**Sustainability & LCA** — EPDs and carbon footprint data in DPPs enable accurate whole-building Life Cycle Assessment for green building certifications (BREEAM, LEED, DGNB).

**Circular Economy** — When buildings are renovated or demolished, DPPs provide data to assess whether materials can be reused, recycled, or require special disposal.`,
  },
  {
    id: 'pages',
    icon: Target,
    title: 'Understanding Each Page',
    subsections: [
      {
        title: 'Home',
        desc: 'Your starting point. Quickly jump to Manual Entry (type product data by hand) or Upload Document (drop a PDF for AI extraction). Also shows the 4-step workflow overview.',
      },
      {
        title: 'Dashboard',
        desc: 'A real-time overview of your entire DPP system — total passports created, number of manufacturers, average AI confidence, and charts breaking down passports by category, country, and document type. Use this to see the big picture at a glance.',
      },
      {
        title: 'Manual Entry',
        desc: 'A guided form with 6 sections for entering product data by hand. Use this when you don\'t have a PDF, or when a document is too complex for AI. Section 4 (Technical Properties) and Section 6 (Custom Fields) let you add unlimited rows for any data.',
      },
      {
        title: 'Upload PDF',
        desc: 'Drop one or multiple PDFs. The AI reads the document, extracts product properties, and generates a DPP automatically. Supports TDS, EPD, DoP, and Test Reports. Batch mode processes up to 20 files at once.',
      },
      {
        title: 'Saved Passports',
        desc: 'Your passport library. View, search, edit, delete, and export passports. Export as CSV, Excel, or PDF. Import from spreadsheets. Click any passport to see full details, download JSON, edit fields, or generate a PDF report.',
      },
      {
        title: 'Manufacturers',
        desc: 'A CRM (relationship tracker) for manufacturers. Track each manufacturer through 4 stages: Target, Engaged, Onboarded, Active. Log your calls, emails, and meetings. Helps you manage outreach when digitizing multiple companies\' products.',
      },
      {
        title: 'Market Coverage',
        desc: 'Shows which product categories you\'ve covered with DPPs. For example: "Cement — 5 products, 3 manufacturers, avg confidence 91%". Expand any category to see key standards referenced. Helps identify gaps in your coverage.',
      },
      {
        title: 'Settings',
        desc: 'Configure the application — API keys for AI services (Gemini, OpenAI), application preferences, and deployment settings.',
      },
    ],
  },
  {
    id: 'documents',
    icon: Layers,
    title: 'Supported Document Types',
    subsections: [
      {
        title: 'Technical Data Sheet (TDS)',
        desc: 'The primary source document. Contains product description, technical properties (compressive strength, tensile adhesion, density), working properties (pot life, open time, coverage), application guidelines, standards compliance, and packaging/storage. DPP Forge extracts all numerical values with units and test method references.',
      },
      {
        title: 'Environmental Product Declaration (EPD)',
        desc: 'Standardized report (EN 15804) quantifying environmental impact. DPP Forge extracts LCA indicators: Global Warming Potential (GWP), Ozone Depletion Potential (ODP), Acidification Potential (AP), Eutrophication Potential (EP), and resource depletion values.',
      },
      {
        title: 'Declaration of Performance (DoP)',
        desc: 'Required for CE-marked products under the EU Construction Products Regulation (CPR). Contains notified body number, AVCP system (1/1+/2+/3/4), essential characteristics, and declared performance. DPP Forge extracts CE marking details.',
      },
      {
        title: 'Test Report / Lab Certificate',
        desc: 'Laboratory test results validating performance claims. DPP Forge extracts test methods, specimen details, measured values, and pass/fail conclusions with full traceability.',
      },
    ],
  },
  {
    id: 'manual-entry',
    icon: ClipboardCheck,
    title: 'Manual Entry — All 6 Sections Explained',
    subsections: [
      {
        title: '1. Basic Information',
        desc: 'Product Name (required), Manufacturer (required), Category (e.g. Cement, Adhesive, Steel), Batch Number, Origin Country, Factory Location, and Description. These identify the product uniquely.',
      },
      {
        title: '2. Packaging & Storage',
        desc: 'How the product is packaged (e.g. "25 kg bags"), storage conditions (e.g. "Dry, covered area"), and shelf life in months. Important for logistics and on-site handling.',
      },
      {
        title: '3. Standards & Applications',
        desc: 'Comma-separated list of standards the product complies with (e.g. "IS 12269, EN 197-1") and applications it\'s used for (e.g. "Road construction, Foundation work"). These prove the product is certified.',
      },
      {
        title: '4. Technical Properties',
        desc: 'The core data. Add rows with Property Name (e.g. "Compressive Strength"), Value (e.g. "53"), Unit (e.g. "MPa"), and Test Method (e.g. "IS 4031"). Click "+ Add Row" for more properties. Every construction product has different properties — this section is fully flexible.',
      },
      {
        title: '5. Sustainability (Optional)',
        desc: 'Recycled content percentage, carbon footprint value and unit. Used for green building calculations and environmental compliance. Leave blank if not available.',
      },
      {
        title: '6. Custom Fields (Optional)',
        desc: 'For anything not covered in sections 1-5. Examples: Fire Rating, VOC Level, Seismic Zone, MSDS Reference, Regional Certification, Color, Texture, or any product-specific detail. Click "+ Add Field", type the label and value. No limit on how many fields you can add.',
      },
    ],
  },
  {
    id: 'import-export',
    icon: FileSearch,
    title: 'Import & Export Features',
    content: `DPP Forge supports multiple ways to get data in and out:

**CSV Export** — Download all passports as a comma-separated file. Opens in Excel, Google Sheets, or any spreadsheet tool. Contains 16 columns covering product identity, properties, standards, and metadata.

**Excel Export** — A formatted .xlsx file with styled headers, alternating row colors, auto-filter, frozen header row, and auto-sized columns. Ready for presentations and reports.

**PDF Export** — Generate a professional A4 PDF for any individual passport. Contains product info table, technical properties, standards compliance, sustainability data, and generation timestamp. Perfect for printing or sharing with clients.

**Spreadsheet Import** — Upload a CSV or Excel file to bulk-create passports. Flexible column matching — "Product Name", "product_name", or "Name" all work. Great for migrating existing product databases into DPP format.

**JSON Download** — Download the raw DPP JSON for any passport. Machine-readable format for integration with other systems, APIs, or databases.

**IFC Export (BIM)** — Export any passport as an IFC4 file for Building Information Modeling. The IFC file maps product identity, technical properties, standards compliance, and sustainability data into standard IfcPropertySets — ready to import into Revit, ArchiCAD, Tekla, or any IFC-compatible BIM tool. This bridges the gap between product data and construction modeling.

**Batch Upload** — Drop up to 20 PDFs at once. Each file is processed independently through the AI pipeline. Results show which succeeded and which failed, with click-to-review for each.`,
  },
  {
    id: 'edit-passport',
    icon: FileText,
    title: 'Editing Passports After Saving',
    content: `Made a mistake? No problem. Every saved passport can be edited:

**How to Edit** — Go to Saved Passports, click any passport card to open the detail view, then click the "Edit" button at the bottom. A form appears where you can change Product Name, Manufacturer, Category, and Description.

**What Gets Updated** — The changes are saved to both the passport record and the underlying DPP JSON. The passport card in the list updates immediately.

**When to Edit** — Common reasons: fixing a typo in the product name, updating the manufacturer name, correcting the category classification, or adding a description that was missing from the original document.`,
  },
  {
    id: 'ocr',
    icon: FileSearch,
    title: 'OCR — Processing Scanned Documents',
    content: `Some PDFs are scanned images rather than digital text. DPP Forge handles this automatically:

**How It Works** — When you upload a PDF, the system first tries to extract digital text. If the text is too short or the pages are detected as images, it automatically switches to OCR mode.

**OCR Process** — Each page is rendered at 300 DPI (high quality), converted to an image, and processed by Tesseract OCR to read the text from the image. The extracted text is then sent to the AI pipeline just like normal text.

**Limitations** — OCR works best with clear, high-resolution scans. Handwritten text, very low quality scans, or heavily decorated pages may produce errors. Always review the confidence scores after OCR extraction.

**Max Pages** — OCR processes up to 10 pages per document to keep processing time reasonable.`,
  },
  {
    id: 'crm',
    icon: Factory,
    title: 'Manufacturer CRM Pipeline',
    content: `DPP Forge includes a built-in CRM for managing manufacturer relationships through the DPP onboarding process:

**What is a CRM?** — CRM stands for Customer Relationship Management. Here it means tracking which manufacturers you're working with to get their products digitized into DPPs. Think of it as a to-do list for manufacturer outreach.

**Target** — Manufacturers identified as needing DPP coverage. Track their product categories, country, website, and initial research notes.

**Engaged** — Active outreach. Log activities (emails, calls, meetings) with timestamped notes. Track which documents they've provided and what's still needed.

**Onboarded** — Manufacturer has agreed to participate. The onboarding date is auto-recorded. Processing of their product documentation begins.

**Active** — Full DPP coverage in place. Verified passports are linked to their profile with counts and product listings visible.

Every stage change is auto-logged as a CRM activity, creating a complete audit trail. Filter by stage, advance with one click, and view the full activity timeline in the detail panel.`,
  },
  {
    id: 'analytics',
    icon: BarChart3,
    title: 'Dashboard & Analytics',
    content: `**What is the Dashboard?** — A single page that summarizes everything happening in your DPP system. Instead of checking each page separately, the dashboard gives you all the key numbers at once.

**Dashboard KPIs** — Total passports created, number of manufacturers tracked, average AI confidence score, and verified passport count. Breakdowns by document type (TDS/EPD/DoP), category, country, and conversion method (AI vs manual).

**CRM Pipeline Chart** — A visual bar showing how many manufacturers are in each stage (Target, Engaged, Onboarded, Active). Tells you at a glance how your outreach is progressing.

**Market Coverage** — The Market Coverage page shows per-category analysis: how many products and manufacturers you've covered in each category (Cement, Steel, Adhesives, etc.), the average confidence, and which specific standards (IS, EN, ISO, ASTM) are referenced. This helps you identify which product segments still need DPP coverage.

**Recent Activity** — Lists the 5 most recently created passports with confidence badges, document types, and creation dates so you can track what was done recently.`,
  },
  {
    id: 'auth',
    icon: Shield,
    title: 'API Security & Authentication',
    content: `DPP Forge includes optional API key authentication to protect your data:

**How It Works** — Set the environment variable DPP_API_KEY to any secret string. Once set, all API requests must include the key via the X-API-Key header or api_key query parameter.

**When to Use** — Enable API key authentication when deploying to the cloud or when multiple people access the same instance. For local/solo use, it's optional.

**Exempt Routes** — The health check (/health), API docs (/docs), and static frontend files are always accessible without a key.

**Rate Limiting** — In addition to API keys, the system has rate limits: 10 uploads per minute, 20 saves per minute, and 5 batch uploads per minute. This prevents abuse and ensures stable performance.`,
  },
  {
    id: 'tech',
    icon: Database,
    title: 'Technical Architecture',
    content: `**Backend** — FastAPI (Python) with SQLAlchemy ORM. SQLite local / PostgreSQL (Supabase) cloud. Rate limiting via SlowAPI.

**Frontend** — React 19 + TypeScript, Vite, TailwindCSS 4, React Router. Fully responsive with mobile sidebar.

**AI Pipeline** — Gemini (primary) → OpenAI (fallback) → Regex (baseline). Document-type-aware prompts with per-field confidence.

**PDF Processing** — PyMuPDF with block-based layout analysis. Multi-column, table-aware, image-page detection. OCR fallback with Tesseract for scanned documents.

**Export** — CSV (csv module), Excel (openpyxl with styling), PDF (reportlab with formatted A4 layout), IFC4 (BIM-ready with IfcPropertySets), JSON download.

**Deployment** — Render.com ready (render.yaml). Gunicorn + Uvicorn workers. SPA fallback routing. Environment variable configuration.

**Security** — Optional API key auth, rate limiting, Pydantic validation, CORS, ORM parameterization.`,
  },
];

/* ─── Shared components ─── */
function SectionHeader({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="text-center mb-2">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 text-white mb-3">
        {icon}
      </div>
      <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">{title}</h2>
      <p className="text-[#8b8fa3] max-w-xl mx-auto">{subtitle}</p>
    </div>
  );
}

/* ─── Main view ─── */
export function TutorialView() {
  const contentRef = useRef<HTMLDivElement>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const scrollToContent = () => {
    contentRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="overflow-hidden">
      {/* Immersive intro */}
      <IntroHero onScrollDown={scrollToContent} />

      <div ref={contentRef} className="max-w-5xl mx-auto px-4 sm:px-8">
        {/* Feature grid */}
        <div className="mb-20">
          <SectionHeader
            icon={<Award className="w-5 h-5" />}
            title="Platform Capabilities"
            subtitle="Everything you need to create, manage, and verify Digital Product Passports at scale"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            {FEATURES.map(f => <FeatureCard key={f.title} feature={f} />)}
          </div>
        </div>

        {/* Interactive stepper */}
        <StepperSection />

        {/* Deep dive accordion */}
        <div className="mb-16">
          <SectionHeader
            icon={<BookOpen className="w-5 h-5" />}
            title="Deep Dive"
            subtitle="Detailed explanations of every major system within DPP Forge"
          />
          <div className="space-y-3 mt-8">
            {DEEP_SECTIONS.map(section => {
              const isExpanded = expandedSection === section.id;
              const Icon = section.icon;
              return (
                <div key={section.id} className="bg-[#1a1d27] border border-[#2e3245] rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                    className="w-full p-5 flex items-center gap-4 hover:bg-[#1e2130] transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#242736] border border-[#2e3245] flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-lg font-semibold text-white flex-1">{section.title}</span>
                    {isExpanded
                      ? <ChevronDown className="w-5 h-5 text-[#8b8fa3]" />
                      : <ChevronRight className="w-5 h-5 text-[#8b8fa3]" />
                    }
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-6 pt-0">
                      <div className="border-t border-[#2e3245] pt-5">
                        {section.content && (
                          <div className="text-[#c0c4d6] text-[15px] leading-[1.8] whitespace-pre-line">
                            {section.content.split('\n\n').map((para, i) => (
                              <p key={i} className="mb-4 last:mb-0">
                                {para.split(/(\*\*[^*]+\*\*)/).map((part, j) => {
                                  if (part.startsWith('**') && part.endsWith('**')) {
                                    return <strong key={j} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
                                  }
                                  return <span key={j}>{part}</span>;
                                })}
                              </p>
                            ))}
                          </div>
                        )}

                        {section.subsections && (
                          <div className="space-y-4">
                            {section.subsections.map((sub, i) => (
                              <div key={i} className="bg-[#0f1117] rounded-xl p-4 border border-[#2e3245]/50">
                                <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                                  {sub.title}
                                </h4>
                                <p className="text-[#c0c4d6] text-sm leading-relaxed">{sub.desc}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pb-12 text-[#63677a] text-sm border-t border-[#2e3245] pt-8">
          <p className="mb-1">DPP Forge v1 — Built for Product Passport Engineers in construction materials</p>
          <p className="text-xs">Powered by FastAPI, React 19, Gemini AI, and the EU ESPR framework</p>
        </div>
      </div>
    </div>
  );
}
