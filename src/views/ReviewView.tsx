import { useState, useEffect, ChangeEvent } from 'react';
import { ArrowLeft, AlertTriangle, CheckCircle, Download, Check, FileJson, QrCode, Loader2, Plus, Trash2, ShieldAlert } from 'lucide-react';
import { api } from '../api';
import { useRole } from '../RoleContext';
import { Input } from '../components/Input';
import type { ConversionResult, SaveResult, DppJson, TechnicalProperty } from '../types';

interface ReviewViewProps {
  setView: (v: string) => void;
  data: ConversionResult;
  onSaved: (data: SaveResult) => void;
  sidebarCollapsed?: boolean;
}

export function ReviewView({ setView, data, onSaved, sidebarCollapsed = false }: ReviewViewProps) {
  const { canApprove, role } = useRole();
  const [dpp, setDpp] = useState<DppJson>(data.extracted_dpp);
  const [loading, setLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [reviewer, setReviewer] = useState('Product Passport Engineer');
  const [reviewedConfidence, setReviewedConfidence] = useState(95);
  const [rightsStatus, setRightsStatus] = useState('manufacturer_authorized');

  const warnings = data.warnings || [];
  const isValid = warnings.length === 0;
  const minimumConfidence = dpp.evidence?.minimum_confidence_required ?? 90;
  const overallConfidence = dpp.confidence?.overall ?? 0;
  const hasConfidence = Boolean(dpp.confidence);
  const blocksSave = hasConfidence && overallConfidence < minimumConfidence;

  useEffect(() => {
    loadQrPreview();
  }, []);

  const loadQrPreview = async () => {
    try {
      const blob = await api.previewQr(dpp);
      setQrPreviewUrl(URL.createObjectURL(blob));
    } catch {
      setQrPreviewUrl(null);
    }
  };

  const handleChange = (field: keyof DppJson, value: string, nestedField?: string) => {
    const updated = nestedField
      ? { ...dpp, [field]: { ...(dpp[field] as Record<string, unknown>), [nestedField]: value } }
      : { ...dpp, [field]: value };
    setDpp(updated as DppJson);
  };

  const handleArrayTextChange = (path: 'standards_compliance' | 'primary_use' | 'suitable_for', value: string) => {
    const values = value.split('\n').map((item) => item.trim()).filter(Boolean);
    if (path === 'standards_compliance') {
      setDpp({ ...dpp, standards_compliance: values });
      return;
    }
    setDpp({ ...dpp, application: { ...dpp.application, [path]: values } });
  };

  const handlePropertyChange = (
    section: 'technical_properties' | 'working_properties',
    key: string,
    field: keyof TechnicalProperty,
    value: string,
  ) => {
    setDpp({
      ...dpp,
      [section]: {
        ...(dpp[section] || {}),
        [key]: { ...(dpp[section]?.[key] || { value: '', unit: '' }), [field]: value },
      },
    });
  };

  const addProperty = (section: 'technical_properties' | 'working_properties') => {
    const base = section === 'technical_properties' ? 'new_property' : 'new_working_property';
    let key = base;
    let suffix = 1;
    while (dpp[section]?.[key]) {
      suffix += 1;
      key = `${base}_${suffix}`;
    }
    setDpp({ ...dpp, [section]: { ...(dpp[section] || {}), [key]: { value: '', unit: '', test_method: '' } } });
  };

  const removeProperty = (section: 'technical_properties' | 'working_properties', key: string) => {
    const next = { ...(dpp[section] || {}) };
    delete next[key];
    setDpp({ ...dpp, [section]: next });
  };

  const handleRecordSectionChange = (
    section: 'identifiers' | 'manufacturing' | 'supply_chain' | 'health_safety' | 'lifecycle',
    key: string,
    value: string,
  ) => {
    setDpp({
      ...dpp,
      [section]: {
        ...((dpp[section] as Record<string, unknown>) || {}),
        [key]: value,
      },
    });
  };

  const displayValue = (value: unknown) => {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value);
  };

  const chainSections: {
    key: 'identifiers' | 'manufacturing' | 'supply_chain' | 'health_safety' | 'lifecycle';
    title: string;
    empty: string;
  }[] = [
    { key: 'identifiers', title: 'Product Identifiers', empty: 'No SKU, GTIN, lot, or serial identifiers captured yet.' },
    { key: 'manufacturing', title: 'Manufacturing & Origin', empty: 'No factory, production, quantity, or origin details captured yet.' },
    { key: 'supply_chain', title: 'Supply Chain & Contact', empty: 'No supplier, transport, or manufacturer contact details captured yet.' },
    { key: 'health_safety', title: 'Health & Safety', empty: 'No hazard, SDS, or handling guidance captured yet.' },
    { key: 'lifecycle', title: 'Lifecycle, Use & End Of Life', empty: 'No installation, maintenance, reuse, recycling, or disposal guidance captured yet.' },
  ];

  const handleApprove = async () => {
    if (!dpp.product_name?.trim() || !dpp.manufacturer?.trim() || !dpp.category?.trim()) {
      setError('Product name, manufacturer, and category are required before approval.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const approval = await api.approveDpp(dpp, reviewer, reviewedConfidence, rightsStatus);
      const finalDpp = approval.dpp_json;
      setDpp(finalDpp);
      const res = await api.saveDpp(finalDpp);
      onSaved(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save DPP');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!dpp.product_name?.trim() || !dpp.manufacturer?.trim()) {
      setError('Product name and manufacturer are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.saveDpp(dpp);
      onSaved(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setLoading(false);
    }
  };

  const downloadJson = async () => {
    try {
      const blob = await api.downloadJson(dpp);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dpp.passport_id || 'dpp-export'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      const blob = new Blob([JSON.stringify(dpp, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dpp.passport_id || 'dpp-export'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const downloadQr = async (qrType = 'dpp_forge') => {
    try {
      const blob = await api.previewQr(dpp, qrType);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dpp.passport_id || 'dpp'}-${qrType === 'constructask' ? 'constructask' : 'dpp-forge'}-qr.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate QR code');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:p-8 pb-56 sm:pb-36">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-5 mb-8 sm:mb-10">
        <div>
          <button onClick={() => setView('home')} className="flex items-center text-[#8b8fa3] hover:text-white mb-6 transition-colors font-medium">
            <ArrowLeft className="w-4 h-4 mr-2" /> Discard & Return
          </button>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Review DPP</h2>
        </div>
        <div className={`self-start sm:self-auto flex items-center px-4 py-2.5 rounded-full text-sm font-semibold border ${isValid ? 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20' : 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20'}`}>
          {isValid ? <CheckCircle className="w-5 h-5 mr-2" /> : <AlertTriangle className="w-5 h-5 mr-2" />}
          {blocksSave ? `Needs ${minimumConfidence}% confidence` : isValid ? 'All Valid' : `${warnings.length} Warning(s)`}
        </div>
      </div>

      {error && (
        <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-2xl p-5 mb-8">
          <p className="text-[#ef4444] font-semibold">{error}</p>
        </div>
      )}

      {!isValid && (
        <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-2xl p-5 mb-8">
          <h4 className="text-[#f59e0b] font-semibold flex items-center mb-3">
            <AlertTriangle className="w-5 h-5 mr-2" /> Action Required
          </h4>
          <ul className="list-disc pl-7 text-[#f59e0b]/80 space-y-1 text-sm font-medium">
            {warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {/* Confidence Score Bar */}
      {dpp.confidence && (
        <div className="bg-[#1a1d27]/80 border border-[#2e3245] rounded-2xl p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-[#8b8fa3] uppercase tracking-wider">AI Extraction Confidence</h4>
            <span className={`text-lg font-bold ${dpp.confidence.overall >= 90 ? 'text-green-400' : dpp.confidence.overall >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
              {dpp.confidence.overall}%
            </span>
          </div>
          <div className="w-full bg-[#0f1117] rounded-full h-2 mb-4">
            <div
              className={`h-full rounded-full transition-all ${dpp.confidence.overall >= 90 ? 'bg-green-500' : dpp.confidence.overall >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${dpp.confidence.overall}%` }}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Product Name', score: dpp.confidence.product_name },
              { label: 'Manufacturer', score: dpp.confidence.manufacturer },
              { label: 'Tech Properties', score: dpp.confidence.technical_properties },
              { label: 'Standards', score: dpp.confidence.standards_compliance },
            ].map(({ label, score }) => (
              <div key={label} className="text-center">
                <div className={`text-sm font-mono font-bold ${score >= 90 ? 'text-green-400' : score >= 70 ? 'text-yellow-400' : score > 0 ? 'text-red-400' : 'text-[#63677a]'}`}>
                  {score > 0 ? `${score}%` : '—'}
                </div>
                <div className="text-xs text-[#63677a] mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          {data.document_type && (
            <div className="mt-3 text-xs text-[#8b8fa3]">
              Document type: <span className="uppercase font-medium text-white">{data.document_type}</span>
            </div>
          )}
          {blocksSave && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              AI confidence is below {minimumConfidence}%. Correct the extracted fields, then approve to mark the record as human-reviewed.
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
        <div className="lg:col-span-7 space-y-8">
          <div className="bg-[#1a1d27]/80 backdrop-blur-sm border border-[#2e3245] rounded-2xl p-5 sm:p-8 shadow-lg">
            <h3 className="text-xl font-bold text-white mb-6">Core Identity (Editable)</h3>
            <div className="space-y-4">
              <Input label="Passport ID" value={dpp.passport_id || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('passport_id', e.target.value)} />
              <label className="block">
                <span className="block text-sm font-semibold text-[#8b8fa3] mb-2">Description</span>
                <textarea
                  value={dpp.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  rows={3}
                  className="w-full bg-[#242736] border border-[#2e3245] rounded-xl px-4 py-3 text-white outline-none focus:border-[#6366f1] resize-y"
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Product Name" value={dpp.product_name || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('product_name', e.target.value)} />
                <Input label="Manufacturer" value={dpp.manufacturer || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('manufacturer', e.target.value)} />
                <Input label="Category" value={dpp.category || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('category', e.target.value)} />
                <Input label="Batch Number" value={dpp.batch_info?.batch_number || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('batch_info', e.target.value, 'batch_number')} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input label="Origin Country" value={dpp.batch_info?.origin_country || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('batch_info', e.target.value, 'origin_country')} />
                <Input label="Factory Location" value={dpp.batch_info?.factory_location || ''} onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('batch_info', e.target.value, 'factory_location')} />
              </div>
            </div>
          </div>

          <div className="bg-[#1a1d27]/80 backdrop-blur-sm border border-[#2e3245] rounded-2xl p-5 sm:p-8 shadow-lg">
            <h3 className="text-xl font-bold text-white mb-6">Traceability Chain</h3>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {chainSections.map(section => {
                const values = (dpp[section.key] || {}) as Record<string, unknown>;
                const entries = Object.entries(values);
                return (
                  <div key={section.key} className="bg-[#242736] border border-[#2e3245] rounded-xl p-4">
                    <h4 className="text-sm font-bold text-white mb-3">{section.title}</h4>
                    {entries.length > 0 ? (
                      <div className="space-y-3">
                        {entries.map(([key, value]) => (
                          <label key={`${section.key}-${key}`} className="block">
                            <span className="block text-xs font-semibold text-[#8b8fa3] mb-1">{key.replace(/_/g, ' ')}</span>
                            <textarea
                              value={displayValue(value)}
                              onChange={(e) => handleRecordSectionChange(section.key, key, e.target.value)}
                              rows={2}
                              className="w-full bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#6366f1] resize-y"
                            />
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[#8b8fa3]">{section.empty}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#1a1d27]/80 backdrop-blur-sm border border-[#2e3245] rounded-2xl p-5 sm:p-8 shadow-lg">
            <div className="flex items-center justify-between gap-3 mb-6">
              <h3 className="text-xl font-bold text-white">Technical Properties</h3>
              <button type="button" onClick={() => addProperty('technical_properties')} className="inline-flex items-center rounded-full bg-[#242736] border border-[#2e3245] px-4 py-2 text-sm font-bold text-white hover:bg-[#2e3245]">
                <Plus className="w-4 h-4 mr-2" /> Add
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Object.entries(dpp.technical_properties || {}).map(([key, prop]: [string, TechnicalProperty]) => (
                <div key={key} className="bg-[#242736] p-4 rounded-xl border border-[#2e3245] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white break-all">{key.replace(/_/g, ' ')}</p>
                    <button type="button" onClick={() => removeProperty('technical_properties', key)} className="p-2 rounded-lg text-red-300 hover:bg-red-500/10" aria-label={`Remove ${key}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input value={prop.value ?? ''} onChange={(e) => handlePropertyChange('technical_properties', key, 'value', e.target.value)} placeholder="Value" className="w-full bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-white outline-none focus:border-[#6366f1]" />
                  <input value={prop.unit || ''} onChange={(e) => handlePropertyChange('technical_properties', key, 'unit', e.target.value)} placeholder="Unit" className="w-full bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-white outline-none focus:border-[#6366f1]" />
                  <input value={prop.test_method || ''} onChange={(e) => handlePropertyChange('technical_properties', key, 'test_method', e.target.value)} placeholder="Test method" className="w-full bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-white outline-none focus:border-[#6366f1]" />
                </div>
              ))}
              {Object.keys(dpp.technical_properties || {}).length === 0 && (
                <p className="text-[#8b8fa3] text-sm italic col-span-2">No technical properties found.</p>
              )}
            </div>
          </div>

          <div className="bg-[#1a1d27]/80 backdrop-blur-sm border border-[#2e3245] rounded-2xl p-5 sm:p-8 shadow-lg">
            <h3 className="text-xl font-bold text-white mb-6">Standards & Applications</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="block">
                <span className="block text-sm font-semibold text-[#8b8fa3] mb-2">Standards</span>
                <textarea value={(dpp.standards_compliance || []).join('\n')} onChange={(e) => handleArrayTextChange('standards_compliance', e.target.value)} rows={7} className="w-full bg-[#242736] border border-[#2e3245] rounded-xl px-4 py-3 text-white outline-none focus:border-[#6366f1] resize-y" />
              </label>
              <label className="block">
                <span className="block text-sm font-semibold text-[#8b8fa3] mb-2">Primary Uses</span>
                <textarea value={(dpp.application?.primary_use || []).join('\n')} onChange={(e) => handleArrayTextChange('primary_use', e.target.value)} rows={7} className="w-full bg-[#242736] border border-[#2e3245] rounded-xl px-4 py-3 text-white outline-none focus:border-[#6366f1] resize-y" />
              </label>
              <label className="block">
                <span className="block text-sm font-semibold text-[#8b8fa3] mb-2">Suitable For</span>
                <textarea value={(dpp.application?.suitable_for || []).join('\n')} onChange={(e) => handleArrayTextChange('suitable_for', e.target.value)} rows={7} className="w-full bg-[#242736] border border-[#2e3245] rounded-xl px-4 py-3 text-white outline-none focus:border-[#6366f1] resize-y" />
              </label>
            </div>
          </div>

          <div className="bg-[#1a1d27]/80 backdrop-blur-sm border border-[#2e3245] rounded-2xl p-5 sm:p-8 shadow-lg">
            <div className="flex items-center justify-between gap-3 mb-6">
              <h3 className="text-xl font-bold text-white">Working Properties</h3>
              <button type="button" onClick={() => addProperty('working_properties')} className="inline-flex items-center rounded-full bg-[#242736] border border-[#2e3245] px-4 py-2 text-sm font-bold text-white hover:bg-[#2e3245]">
                <Plus className="w-4 h-4 mr-2" /> Add
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {Object.entries(dpp.working_properties || {}).map(([key, prop]: [string, TechnicalProperty]) => (
                <div key={key} className="bg-[#242736] p-4 rounded-xl border border-[#2e3245] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white break-all">{key.replace(/_/g, ' ')}</p>
                    <button type="button" onClick={() => removeProperty('working_properties', key)} className="p-2 rounded-lg text-red-300 hover:bg-red-500/10" aria-label={`Remove ${key}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input value={prop.value ?? ''} onChange={(e) => handlePropertyChange('working_properties', key, 'value', e.target.value)} placeholder="Value" className="w-full bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-white outline-none focus:border-[#6366f1]" />
                  <input value={prop.unit || ''} onChange={(e) => handlePropertyChange('working_properties', key, 'unit', e.target.value)} placeholder="Unit" className="w-full bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-white outline-none focus:border-[#6366f1]" />
                  <input value={prop.test_method || ''} onChange={(e) => handlePropertyChange('working_properties', key, 'test_method', e.target.value)} placeholder="Test method" className="w-full bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-white outline-none focus:border-[#6366f1]" />
                </div>
              ))}
              {Object.keys(dpp.working_properties || {}).length === 0 && (
                <p className="text-[#8b8fa3] text-sm italic col-span-2">No working properties found.</p>
              )}
            </div>
          </div>

          <div className="bg-[#1a1d27]/80 backdrop-blur-sm border border-[#2e3245] rounded-2xl p-5 sm:p-8 shadow-lg">
            <h3 className="text-xl font-bold text-white mb-4">Data Rights & Evidence</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <label className="block">
                <span className="block text-sm font-semibold text-[#8b8fa3] mb-2">Reviewer</span>
                <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} className="w-full bg-[#242736] border border-[#2e3245] rounded-xl px-4 py-3 text-white outline-none focus:border-[#6366f1]" />
              </label>
              <label className="block">
                <span className="block text-sm font-semibold text-[#8b8fa3] mb-2">Reviewed Confidence</span>
                <input type="number" min={0} max={100} value={reviewedConfidence} onChange={(e) => setReviewedConfidence(Number(e.target.value))} className="w-full bg-[#242736] border border-[#2e3245] rounded-xl px-4 py-3 text-white outline-none focus:border-[#6366f1]" />
              </label>
              <label className="block">
                <span className="block text-sm font-semibold text-[#8b8fa3] mb-2">Rights Status</span>
                <select value={rightsStatus} onChange={(e) => setRightsStatus(e.target.value)} className="w-full bg-[#242736] border border-[#2e3245] rounded-xl px-4 py-3 text-white outline-none focus:border-[#6366f1]">
                  <option value="manufacturer_authorized">Manufacturer Authorized</option>
                  <option value="public_document">Public Document</option>
                  <option value="licensed_reuse">Licensed Reuse</option>
                  <option value="authority_approved">Authority Approved</option>
                  <option value="internal_review">Internal Review</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="bg-[#242736] border border-[#2e3245] rounded-xl p-4">
                <p className="text-xs font-semibold text-[#8b8fa3] uppercase tracking-wider mb-1">Permission</p>
                <p className="text-white font-medium">{dpp.data_rights?.permission_status || 'internal_review'}</p>
                <p className="text-xs text-[#63677a] mt-2">{dpp.data_rights?.license_notes || 'Confirm manufacturer permission before external publication.'}</p>
              </div>
              <div className="bg-[#242736] border border-[#2e3245] rounded-xl p-4">
                <p className="text-xs font-semibold text-[#8b8fa3] uppercase tracking-wider mb-1">Evidence</p>
                <p className="text-white font-medium">{dpp.evidence?.field_sources?.length || 0} field source(s)</p>
                <p className="text-xs text-[#63677a] mt-2">{dpp.evidence?.quality_notes || 'Add field citations during review.'}</p>
              </div>
            </div>
            {dpp.evidence?.field_sources?.length ? (
              <div className="mt-4 space-y-2">
                {dpp.evidence.field_sources.slice(0, 5).map((source, index) => (
                  <div key={`${source.field}-${index}`} className="flex items-center justify-between gap-3 text-xs bg-[#0f1117] rounded-lg px-3 py-2">
                    <span className="text-white">{source.field}</span>
                    <span className="text-[#8b8fa3] truncate">{source.citation || source.source_title}</span>
                    <span className={(source.ai_confidence ?? source.confidence) >= minimumConfidence ? 'text-green-400' : 'text-yellow-400'}>AI {source.ai_confidence ?? source.confidence}%</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-8 flex flex-col">
          {/* QR Preview */}
          <div className="bg-[#1a1d27]/80 backdrop-blur-sm border border-[#2e3245] rounded-2xl p-5 sm:p-8 shadow-lg text-center">
            <h3 className="text-sm font-bold text-[#8b8fa3] uppercase tracking-wider flex items-center justify-center mb-6">
              <QrCode className="w-4 h-4 mr-2" /> QR Preview
            </h3>
            {qrPreviewUrl ? (
              <div className="bg-white p-4 rounded-2xl inline-block mb-4 shadow-lg">
                <img src={qrPreviewUrl} alt="QR Preview" className="w-40 h-40" />
              </div>
            ) : (
              <div className="w-40 h-40 mx-auto bg-[#242736] rounded-2xl border border-[#2e3245] flex items-center justify-center mb-4">
                <QrCode className="w-12 h-12 text-[#2e3245]" />
              </div>
            )}
            <p className="text-xs text-[#8b8fa3] font-medium">DPP Forge QR preview</p>
          </div>

          {/* DPP JSON Preview */}
          <div className="bg-[#1a1d27]/80 backdrop-blur-sm border border-[#2e3245] rounded-2xl overflow-hidden flex flex-col flex-1 min-h-[280px] sm:min-h-[400px] shadow-lg">
            <div className="flex justify-between items-center p-5 border-b border-[#2e3245] bg-[#0f1117]">
              <h3 className="text-sm font-bold text-[#8b8fa3] uppercase tracking-wider flex items-center">
                <FileJson className="w-4 h-4 mr-2" /> DPP Preview
              </h3>
            </div>
            <div className="flex-1 overflow-auto p-6 bg-[#0a0b10] custom-scrollbar">
              <pre className="text-xs font-mono text-[#e4e6ed] whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(dpp, null, 2)}
              </pre>
            </div>
          </div>

          {data.raw_text_preview && (
            <div className="bg-[#1a1d27]/80 backdrop-blur-sm border border-[#2e3245] rounded-2xl overflow-hidden shadow-lg">
              <button
                onClick={() => setShowRaw(!showRaw)}
                className="w-full p-5 text-left font-bold text-white flex justify-between items-center hover:bg-[#242736] transition-colors"
              >
                Raw Extracted Text
                <span className="text-[#8b8fa3] text-xs font-medium uppercase tracking-wider">{showRaw ? 'Hide' : 'Show'}</span>
              </button>
              {showRaw && (
                <div className="p-5 pt-0 border-t border-[#2e3245] max-h-64 overflow-auto custom-scrollbar bg-[#0a0b10]">
                  <p className="text-xs font-mono text-[#8b8fa3] whitespace-pre-wrap leading-relaxed mt-4">{data.raw_text_preview}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className={`fixed bottom-0 left-0 right-0 ${sidebarCollapsed ? '' : 'md:pl-64'} border-t border-[#2e3245] bg-[#0f1117]/90 backdrop-blur-xl p-3 sm:p-4 z-40`}>
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:justify-between lg:items-center px-1 sm:px-4 gap-3">
          <p className="text-[#8b8fa3] text-sm font-medium hidden lg:block">Correct the AI extraction, then approve the reviewed passport.</p>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3 w-full lg:w-auto lg:ml-auto">
            <button
              onClick={downloadJson}
              className="justify-center flex items-center bg-[#242736] hover:bg-[#2e3245] text-white px-3 sm:px-5 py-3 rounded-full font-bold transition-colors border border-[#2e3245] text-sm sm:text-base"
            >
              <Download className="w-4 h-4 mr-2" /> JSON
            </button>
            <button
              onClick={() => downloadQr('dpp_forge')}
              className="justify-center flex items-center bg-[#242736] hover:bg-[#2e3245] text-white px-3 sm:px-5 py-3 rounded-full font-bold transition-colors border border-[#2e3245] text-sm sm:text-base"
            >
              <QrCode className="w-4 h-4 mr-2" /> DPP QR
            </button>
            <button
              onClick={() => downloadQr('constructask')}
              className="justify-center flex items-center bg-[#242736] hover:bg-[#2e3245] text-white px-3 sm:px-5 py-3 rounded-full font-bold transition-colors border border-[#2e3245] text-sm sm:text-base"
            >
              <QrCode className="w-4 h-4 mr-2" /> ConstructAsk QR
            </button>
            {canApprove ? (
              <button
                onClick={handleApprove}
                disabled={loading}
                className="col-span-2 sm:col-span-1 justify-center flex items-center bg-white text-black px-5 sm:px-8 py-3 rounded-full font-bold hover:bg-gray-200 transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(255,255,255,0.2)] text-sm sm:text-base"
              >
                {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
                {loading ? 'Generating...' : 'Approve & Generate QR'}
              </button>
            ) : (
              <button
                onClick={handleSaveDraft}
                disabled={loading}
                className="col-span-2 sm:col-span-1 justify-center flex items-center bg-white text-black px-5 sm:px-8 py-3 rounded-full font-bold hover:bg-gray-200 transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(255,255,255,0.2)] text-sm sm:text-base"
                title="Switch to Reviewer role to approve and generate QR"
              >
                {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
                {loading ? 'Saving...' : 'Save Draft (Approval requires Reviewer role)'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
