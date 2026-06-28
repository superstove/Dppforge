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
  source_document: {
    type: string;
    document_title: string;
    revision: string;
    date_issued: string;
    conversion_method: string;
    converted_by: string;
    conversion_date: string;
  };
}

export interface PassportSummary {
  id: number;
  passport_id: string;
  product_name: string;
  manufacturer: string;
  category: string;
  batch_number: string;
  conversion_method: string;
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
  warnings: string[];
  extracted_dpp: DppJson;
  raw_text_preview?: string;
  raw_text_length?: number;
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

export type ViewName = 'home' | 'manual' | 'upload' | 'review' | 'saved' | 'passports' | 'settings';
