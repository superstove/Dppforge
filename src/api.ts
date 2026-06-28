import { CarbonResult, ComplianceOverview, ComplianceResult, ComplianceRulebook, ConversionResult, DashboardStats, DppJson, ExpiryDashboard, GS1Identifier, ManufacturerClaim, ManufacturerDetail, ManufacturerSummary, MarketCoverage, NotificationLogEntry, PaginatedResponse, PassportCarbon, PassportDetail, PassportSummary, SaveResult, TargetMarketCoverage, TranslatedPassport, WebhookConfig } from './types';

const configuredApiUrl = import.meta.env.VITE_API_URL || '/api';
export const API_BASE = configuredApiUrl.replace(/\/$/, '');

export function resolveAssetUrl(path?: string | null) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  if (!API_BASE.startsWith('http')) return path;

  const backendOrigin = API_BASE.endsWith('/api')
    ? API_BASE.slice(0, -4)
    : API_BASE;
  return `${backendOrigin}${path.startsWith('/') ? path : `/${path}`}`;
}

export const api = {
  convertManual: async (data: unknown): Promise<ConversionResult> => {
    const res = await fetch(`${API_BASE}/convert/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Conversion failed' }));
      throw new Error(err.detail || 'Conversion failed');
    }
    return await res.json();
  },

  convertUpload: async (file: File, docType = 'tds'): Promise<ConversionResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/convert/upload?doc_type=${docType}`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Extraction failed' }));
      throw new Error(err.detail || 'Extraction failed');
    }
    return await res.json();
  },

  saveDpp: async (dpp_json: DppJson): Promise<SaveResult> => {
    const res = await fetch(`${API_BASE}/convert/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dpp_json })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Save failed' }));
      throw new Error(err.detail || 'Save failed');
    }
    return await res.json();
  },

  previewQr: async (dpp_json: DppJson, qr_type = 'dpp_forge'): Promise<Blob> => {
    const res = await fetch(`${API_BASE}/convert/preview-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dpp_json, qr_type })
    });
    if (!res.ok) throw new Error('QR generation failed');
    return await res.blob();
  },

  downloadJson: async (dpp_json: DppJson): Promise<Blob> => {
    const res = await fetch(`${API_BASE}/convert/download-json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dpp_json })
    });
    if (!res.ok) throw new Error('JSON download failed');
    return await res.blob();
  },

  getPassports: async (limit = 50, offset = 0): Promise<PaginatedResponse<PassportSummary>> => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const res = await fetch(`${API_BASE}/passports/?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to load passports');
    return await res.json();
  },

  getPassport: async (id: number | string): Promise<PassportDetail> => {
    const res = await fetch(`${API_BASE}/passports/${id}`);
    if (!res.ok) throw new Error('Failed to load passport');
    return await res.json();
  },

  deletePassport: async (id: number | string) => {
    const res = await fetch(`${API_BASE}/passports/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete passport');
    return await res.json();
  },

  exportCsv: async (): Promise<Blob> => {
    const res = await fetch(`${API_BASE}/passports/export/csv`);
    if (!res.ok) throw new Error('CSV export failed');
    return await res.blob();
  },

  exportExcel: async (): Promise<Blob> => {
    const res = await fetch(`${API_BASE}/passports/export/excel`);
    if (!res.ok) throw new Error('Excel export failed');
    return await res.blob();
  },

  importSpreadsheet: async (file: File): Promise<{ status: string; imported: number; skipped: number; errors: string[]; message: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/passports/import/spreadsheet`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Import failed' }));
      throw new Error(err.detail || 'Import failed');
    }
    return await res.json();
  },

  updatePassport: async (id: number, data: Record<string, unknown>): Promise<{ status: string; id: number; passport_id: string }> => {
    const res = await fetch(`${API_BASE}/passports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Update failed' }));
      throw new Error(err.detail || 'Update failed');
    }
    return await res.json();
  },

  exportPassportPdf: async (id: number): Promise<Blob> => {
    const res = await fetch(`${API_BASE}/passports/${id}/export-pdf`);
    if (!res.ok) throw new Error('PDF export failed');
    return await res.blob();
  },

  exportPassportIfc: async (id: number): Promise<Blob> => {
    const res = await fetch(`${API_BASE}/passports/${id}/export-ifc`);
    if (!res.ok) throw new Error('IFC export failed');
    return await res.blob();
  },

  batchUpload: async (files: File[], docType = 'tds'): Promise<{ status: string; total: number; succeeded: number; failed: number; results: ConversionResult[] }> => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    const res = await fetch(`${API_BASE}/convert/batch-upload?doc_type=${docType}`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Batch upload failed' }));
      throw new Error(err.detail || 'Batch upload failed');
    }
    return await res.json();
  },

  // Analytics
  getDashboard: async (): Promise<DashboardStats> => {
    const res = await fetch(`${API_BASE}/analytics/dashboard`);
    if (!res.ok) throw new Error('Failed to load dashboard');
    return await res.json();
  },

  getMarketCoverage: async (): Promise<MarketCoverage> => {
    const res = await fetch(`${API_BASE}/analytics/market-coverage`);
    if (!res.ok) throw new Error('Failed to load market coverage');
    return await res.json();
  },

  getTargetMarketCoverage: async (): Promise<TargetMarketCoverage> => {
    const res = await fetch(`${API_BASE}/analytics/target-market-coverage`);
    if (!res.ok) throw new Error('Failed to load target market coverage');
    return await res.json();
  },

  // Manufacturers
  getManufacturers: async (stage?: string): Promise<{ total: number; items: ManufacturerSummary[] }> => {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    const res = await fetch(`${API_BASE}/manufacturers/?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to load manufacturers');
    return await res.json();
  },

  getManufacturer: async (id: number): Promise<ManufacturerDetail> => {
    const res = await fetch(`${API_BASE}/manufacturers/${id}`);
    if (!res.ok) throw new Error('Failed to load manufacturer');
    return await res.json();
  },

  createManufacturer: async (data: Partial<ManufacturerSummary>): Promise<ManufacturerSummary> => {
    const res = await fetch(`${API_BASE}/manufacturers/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Create failed' }));
      throw new Error(err.detail || 'Create failed');
    }
    return await res.json();
  },

  updateManufacturer: async (id: number, data: Partial<ManufacturerSummary>): Promise<ManufacturerSummary> => {
    const res = await fetch(`${API_BASE}/manufacturers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Update failed');
    return await res.json();
  },

  deleteManufacturer: async (id: number) => {
    const res = await fetch(`${API_BASE}/manufacturers/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    return await res.json();
  },

  addManufacturerActivity: async (id: number, activity_type: string, description: string) => {
    const res = await fetch(`${API_BASE}/manufacturers/${id}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activity_type, description }),
    });
    if (!res.ok) throw new Error('Failed to add activity');
    return await res.json();
  },

  submitManufacturerClaim: async (id: number, data: Record<string, string>): Promise<ManufacturerClaim> => {
    const res = await fetch(`${API_BASE}/manufacturers/${id}/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to submit claim');
    return await res.json();
  },

  reviewManufacturerClaim: async (claimId: number, data: Record<string, string>): Promise<ManufacturerClaim> => {
    const res = await fetch(`${API_BASE}/manufacturers/claims/${claimId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to review claim');
    return await res.json();
  },

  getOutreachTemplate: async (id: number): Promise<{ email_subject: string; email_body: string; phone_script: string; video_agenda: string[] }> => {
    const res = await fetch(`${API_BASE}/manufacturers/${id}/outreach-template`);
    if (!res.ok) throw new Error('Failed to load outreach template');
    return await res.json();
  },

  getPipelineSummary: async (): Promise<{ stages: Record<string, number>; total: number }> => {
    const res = await fetch(`${API_BASE}/manufacturers/pipeline`);
    if (!res.ok) throw new Error('Failed to load pipeline');
    return await res.json();
  },

  // Compliance
  checkCompliance: async (id: number): Promise<ComplianceResult> => {
    const res = await fetch(`${API_BASE}/compliance/${id}/check`);
    if (!res.ok) throw new Error('Compliance check failed');
    return await res.json();
  },

  complianceOverview: async (): Promise<ComplianceOverview> => {
    const res = await fetch(`${API_BASE}/compliance/overview`);
    if (!res.ok) throw new Error('Failed to load compliance overview');
    return await res.json();
  },

  complianceRulebook: async (): Promise<ComplianceRulebook> => {
    const res = await fetch(`${API_BASE}/compliance/rulebook`);
    if (!res.ok) throw new Error('Failed to load compliance rulebook');
    return await res.json();
  },

  getAccessTier: async (id: number, tier: string): Promise<Record<string, unknown>> => {
    const res = await fetch(`${API_BASE}/compliance/${id}/access?tier=${tier}`);
    if (!res.ok) throw new Error('Failed to load access tier');
    return await res.json();
  },

  getGS1: async (id: number): Promise<GS1Identifier> => {
    const res = await fetch(`${API_BASE}/compliance/${id}/gs1`);
    if (!res.ok) throw new Error('Failed to generate GS1');
    return await res.json();
  },

  carbonCalculator: async (data: Record<string, unknown>): Promise<CarbonResult> => {
    const res = await fetch(`${API_BASE}/compliance/carbon-calculator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Carbon calculation failed');
    return await res.json();
  },

  passportCarbon: async (id: number): Promise<PassportCarbon> => {
    const res = await fetch(`${API_BASE}/compliance/${id}/carbon`);
    if (!res.ok) throw new Error('Failed to load carbon data');
    return await res.json();
  },

  registryExport: async (id: number): Promise<Record<string, unknown>> => {
    const res = await fetch(`${API_BASE}/compliance/${id}/registry-export`);
    if (!res.ok) throw new Error('Registry export failed');
    return await res.json();
  },

  // Webhooks
  getWebhooks: async (): Promise<{ total: number; items: WebhookConfig[] }> => {
    const res = await fetch(`${API_BASE}/notifications/webhooks`);
    if (!res.ok) throw new Error('Failed to load webhooks');
    return await res.json();
  },

  createWebhook: async (data: { name: string; url: string; events: string[]; channel: string }): Promise<WebhookConfig> => {
    const res = await fetch(`${API_BASE}/notifications/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create webhook');
    return await res.json();
  },

  updateWebhook: async (id: number, data: Partial<WebhookConfig>): Promise<{ status: string }> => {
    const res = await fetch(`${API_BASE}/notifications/webhooks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update webhook');
    return await res.json();
  },

  deleteWebhook: async (id: number): Promise<{ status: string }> => {
    const res = await fetch(`${API_BASE}/notifications/webhooks/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete webhook');
    return await res.json();
  },

  testWebhook: async (id: number): Promise<{ status: string; payload: Record<string, unknown> }> => {
    const res = await fetch(`${API_BASE}/notifications/webhooks/${id}/test`, { method: 'POST' });
    if (!res.ok) throw new Error('Webhook test failed');
    return await res.json();
  },

  getNotificationLogs: async (): Promise<{ total: number; items: NotificationLogEntry[] }> => {
    const res = await fetch(`${API_BASE}/notifications/logs`);
    if (!res.ok) throw new Error('Failed to load logs');
    return await res.json();
  },

  getNotificationEvents: async (): Promise<{ events: { id: string; label: string; description: string }[] }> => {
    const res = await fetch(`${API_BASE}/notifications/events`);
    if (!res.ok) throw new Error('Failed to load events');
    return await res.json();
  },

  // Multi-language
  getLanguages: async (): Promise<{ languages: { code: string; name: string }[] }> => {
    const res = await fetch(`${API_BASE}/notifications/languages`);
    if (!res.ok) throw new Error('Failed to load languages');
    return await res.json();
  },

  translatePassport: async (id: number, lang: string): Promise<TranslatedPassport> => {
    const res = await fetch(`${API_BASE}/notifications/${id}/translate/${lang}`);
    if (!res.ok) throw new Error('Translation failed');
    return await res.json();
  },

  // Expiry alerts
  getExpiryAlerts: async (days?: number): Promise<{ stats: Record<string, number>; total_alerts: number; alerts: import('./types').ExpiryAlert[] }> => {
    const params = days ? `?days=${days}` : '';
    const res = await fetch(`${API_BASE}/notifications/expiry-alerts${params}`);
    if (!res.ok) throw new Error('Failed to load expiry alerts');
    return await res.json();
  },

  getExpiryDashboard: async (): Promise<ExpiryDashboard> => {
    const res = await fetch(`${API_BASE}/notifications/expiry-dashboard`);
    if (!res.ok) throw new Error('Failed to load expiry dashboard');
    return await res.json();
  },
};
