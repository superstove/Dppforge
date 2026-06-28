export interface TechnicalProperty {
  value: number | string;
  unit: string;
  test_method?: string;
}

export interface DppJson {
  dpp_version: string;
  passport_id: string;
  product_name: string;
  manufacturer: string;
  category: string;
  description: string;
  document_type?: string;
  technical_properties: Record<string, TechnicalProperty>;
  working_properties: Record<string, TechnicalProperty>;
  application: {
    primary_use: string[];
    suitable_for: string[];
  };
  standards_compliance: string[];
  packaging_and_storage: {
    packaging: string;
    storage: string;
    shelf_life: { value: number; unit: string; condition: string };
  };
  sustainability: {
    recycled_content_pct: number;
    carbon_footprint: { value: number; unit: string };
    recyclable: boolean;
  };
  batch_info: {
    batch_number: string;
    production_date: string;
    origin_country: string;
    factory_location: string;
  };
  qr_verification: {
    qr_code: string;
    verification_url: string;
    scan_type: string;
  };
  confidence?: {
    overall: number;
    product_name: number;
    manufacturer: number;
    technical_properties: number;
    standards_compliance: number;
  };
  source_document: {
    type: string;
    document_type_code?: string;
    document_title: string;
    revision: string;
    date_issued: string;
    conversion_method: string;
    converted_by: string;
    conversion_date: string;
  };
  data_rights?: {
    permission_status: string;
    rights_holder: string;
    allowed_uses: string[];
    license_notes: string;
  };
  evidence?: {
    minimum_confidence_required: number;
    field_sources: {
      field: string;
      source_type: string;
      source_title: string;
      citation: string;
      confidence: number;
    }[];
    quality_notes: string;
  };
  audit_trail?: {
    event: string;
    actor: string;
    method: string;
    timestamp: string;
  }[];
}

export interface PassportSummary {
  id: number;
  passport_id: string;
  product_name: string;
  manufacturer: string;
  category: string;
  batch_number: string;
  conversion_method: string;
  document_type?: string;
  confidence_score?: number;
  standards_count: number;
  properties_count: number;
  qr_code_url: string | null;
  constructask_qr_code_url?: string | null;
  status: string;
  created_at: string;
}

export interface PassportDetail extends PassportSummary {
  origin_country: string;
  dpp_json: DppJson;
}

export interface ConversionResult {
  status: string;
  conversion_method: string;
  document_type?: string;
  warnings: string[];
  extracted_dpp: DppJson;
  raw_text_preview?: string;
  raw_text_length?: number;
  source_file_name?: string;
}

export interface SaveResult {
  status: string;
  id: number;
  passport_id: string;
  product_name: string;
  qr_code_url: string;
  dpp_qr_code_url?: string;
  constructask_qr_code_url?: string;
  verification_url: string;
  dpp_verification_url?: string;
  constructask_verification_url?: string;
  message: string;
}

export interface PaginatedResponse<T> {
  total: number;
  limit: number;
  offset: number;
  items: T[];
}

export interface ManufacturerSummary {
  id: number;
  name: string;
  country: string;
  website: string;
  contact_email: string;
  contact_phone: string;
  contact_person: string;
  crm_stage: string;
  notes: string;
  categories: string;
  products_count: number;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CRMActivity {
  id: number;
  activity_type: string;
  description: string;
  created_at: string;
}

export interface ManufacturerClaim {
  id: number;
  manufacturer_id: number;
  claimant_name: string;
  claimant_email: string;
  role: string;
  rights_basis: string;
  requested_scope: string;
  status: string;
  reviewer: string;
  review_notes: string;
  created_at: string;
  reviewed_at: string | null;
}

export interface ManufacturerDetail extends ManufacturerSummary {
  passports: PassportSummary[];
  activities: CRMActivity[];
  claim_profile: {
    status: string;
    claim_count: number;
    latest_claim_id: number | null;
    rights_basis: string;
    requested_scope: string;
  };
  claims: ManufacturerClaim[];
}

export interface DashboardStats {
  overview: {
    total_passports: number;
    total_manufacturers: number;
    avg_confidence: number;
    high_confidence_count: number;
    verified_count: number;
    high_confidence_pct: number;
  };
  by_conversion_method: Record<string, number>;
  by_document_type: Record<string, number>;
  by_category: { category: string; count: number }[];
  by_country: { country: string; count: number }[];
  crm_pipeline: Record<string, number>;
  recent_passports: {
    id: number;
    passport_id: string;
    product_name: string;
    manufacturer: string;
    confidence_score: number;
    document_type: string;
    created_at: string;
  }[];
}

export interface MarketCoverage {
  categories: {
    category: string;
    product_count: number;
    manufacturer_count: number;
    avg_confidence: number;
    total_standards_refs: number;
    key_standards: string[];
  }[];
  total_categories: number;
}

export interface TargetMarketCoverage {
  targets: {
    category: string;
    key_products: string[];
    required_standards: string[];
    required_documents: string[];
    covered_products: number;
    covered_manufacturers: number;
    coverage_status: 'covered' | 'gap';
  }[];
  total_targets: number;
  method: string;
}

export interface ComplianceRulebook {
  validation_status: string;
  disclaimer: string;
  rules: {
    id: string;
    name: string;
    source_type: string;
    source: string;
    validation_status: string;
  }[];
}

export interface ComplianceField {
  field: string;
  label: string;
  description: string;
  regulation: string;
  access_tier: string;
  status: 'pass' | 'warning' | 'missing';
  value: string | null;
}

export interface ComplianceResult {
  passport_id: string;
  product_name: string;
  category: string;
  is_cpr_product: boolean;
  compliance_score: number;
  grade: 'green' | 'amber' | 'red';
  summary: { total_fields: number; pass: number; warning: number; missing: number };
  fields: ComplianceField[];
  applicable_regulations: string[];
}

export interface ComplianceOverview {
  total: number;
  green: number;
  amber: number;
  red: number;
  avg_score: number;
  items: {
    id: number;
    passport_id: string;
    product_name: string;
    manufacturer: string;
    category: string;
    compliance_score: number;
    grade: 'green' | 'amber' | 'red';
  }[];
}

export interface GS1Identifier {
  passport_id: string;
  product_name: string;
  gs1: {
    gtin: string;
    serial_number: string;
    digital_link_uri: string;
    data_carrier: string;
    ai_01: string;
    ai_21: string;
  };
}

export interface CarbonResult {
  material: string;
  weight_kg: number;
  gwp_factor: number;
  gwp_factor_source: string;
  recycled_content_pct: number;
  recycled_reduction_factor: number;
  transport_mode: string;
  transport_km: number;
  lca_stages: { A1_A3_production: number; A4_transport: number; total_A1_A4: number };
  total_gwp_kgCO2e: number;
  unit: string;
  gwp_per_unit: number;
  gwp_per_unit_label: string;
  methodology: string;
  available_materials: string[];
}

export interface PassportCarbon {
  passport_id: string;
  product_name: string;
  category: string;
  declared_gwp?: { value: number; unit: string; source: string };
  reference_gwp?: { value: number; unit: string; source: string; material: string } | null;
  gwp_rating?: string;
  vs_benchmark?: string;
  recycled_content_pct: number;
  cpr_applicable: boolean;
  cpr_deadline: string | null;
}

export interface WebhookConfig {
  id: number;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  secret: string | null;
  channel: string;
  created_at: string;
  last_triggered: string | null;
  trigger_count: number;
}

export interface NotificationLogEntry {
  id: number;
  event: string;
  channel: string;
  status: string;
  payload_preview: string;
  response_code: number;
  created_at: string;
}

export interface ExpiryAlert {
  passport_id: string;
  product_name: string;
  manufacturer: string;
  record_id: number;
  certificate: string;
  certificate_type: string;
  expiry_date: string;
  days_until_expiry: number;
  status: 'expired' | 'expiring';
  urgency: 'critical' | 'urgent' | 'warning' | 'ok';
  recommendation: string;
}

export interface ExpiryTimelineItem {
  passport_id: string;
  product_name: string;
  certificate: string;
  expiry_date: string;
  days_until: number;
  record_id: number;
}

export interface ExpiryDashboard {
  scan_date: string;
  total_alerts: number;
  headline: string;
  timeline: {
    overdue: ExpiryTimelineItem[];
    this_week: ExpiryTimelineItem[];
    this_month: ExpiryTimelineItem[];
    next_3_months: ExpiryTimelineItem[];
  };
}

export interface TranslatedPassport {
  language: { code: string; name: string; direction: string };
  passport: Record<string, unknown>;
  field_labels: Record<string, string>;
}

export type ViewName = 'home' | 'manual' | 'upload' | 'review' | 'saved' | 'passports' | 'settings' | 'dashboard' | 'manufacturers' | 'market' | 'tutorial' | 'compliance' | 'notifications';
