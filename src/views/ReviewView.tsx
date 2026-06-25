import { useState, useEffect } from 'react';
import { ArrowLeft, AlertTriangle, CheckCircle, Download, Check, FileJson, QrCode, Loader2 } from 'lucide-react';
import { api } from '../api';
import { Input } from '../components/Input';

export function ReviewView({ setView, data, onSaved }: any) {
  const [dpp, setDpp] = useState(data.extracted_dpp || {});
  const [loading, setLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  const warnings = data.warnings || [];
  const isValid = warnings.length === 0;

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

  const handleChange = (field: string, value: string, nestedField?: string) => {
    const updated = nestedField
      ? { ...dpp, [field]: { ...dpp[field], [nestedField]: value } }
      : { ...dpp, [field]: value };
    setDpp(updated);
  };

  const handleApprove = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.saveDpp(dpp);
      onSaved(res);
    } catch (err: any) {
      setError(err.message || 'Failed to save DPP');
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

  const downloadQr = async () => {
    try {
      const blob = await api.previewQr(dpp);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dpp.passport_id || 'dpp-qr'}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to generate QR code');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-8 pb-32">
      <div className="flex justify-between items-end mb-10">
        <div>
          <button onClick={() => setView('home')} className="flex items-center text-[#8b8fa3] hover:text-white mb-6 transition-colors font-medium">
            <ArrowLeft className="w-4 h-4 mr-2" /> Discard & Return
          </button>
          <h2 className="text-4xl font-bold text-white tracking-tight">Review DPP</h2>
        </div>
        <div className={`flex items-center px-4 py-2.5 rounded-full text-sm font-semibold border ${isValid ? 'bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20' : 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20'}`}>
          {isValid ? <CheckCircle className="w-5 h-5 mr-2" /> : <AlertTriangle className="w-5 h-5 mr-2" />}
          {isValid ? 'All Valid' : `${warnings.length} Warning(s)`}
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
        <div className="lg:col-span-7 space-y-8">
          <div className="bg-[#1a1d27]/80 backdrop-blur-sm border border-[#2e3245] rounded-2xl p-8 shadow-lg">
            <h3 className="text-xl font-bold text-white mb-6">Core Identity (Editable)</h3>
            <div className="space-y-4">
              <Input label="Passport ID" value={dpp.passport_id || ''} onChange={(e: any) => handleChange('passport_id', e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Product Name" value={dpp.product_name || ''} onChange={(e: any) => handleChange('product_name', e.target.value)} />
                <Input label="Manufacturer" value={dpp.manufacturer || ''} onChange={(e: any) => handleChange('manufacturer', e.target.value)} />
                <Input label="Category" value={dpp.category || ''} onChange={(e: any) => handleChange('category', e.target.value)} />
                <Input label="Batch Number" value={dpp.batch_info?.batch_number || ''} onChange={(e: any) => handleChange('batch_info', e.target.value, 'batch_number')} />
              </div>
            </div>
          </div>

          <div className="bg-[#1a1d27]/80 backdrop-blur-sm border border-[#2e3245] rounded-2xl p-8 shadow-lg">
            <h3 className="text-xl font-bold text-white mb-6">Technical Properties</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Object.entries(dpp.technical_properties || {}).map(([key, prop]: any) => (
                <div key={key} className="bg-[#242736] p-4 rounded-xl border border-[#2e3245]">
                  <p className="text-xs font-semibold text-[#8b8fa3] uppercase tracking-wider mb-2">{key.replace(/_/g, ' ')}</p>
                  <p className="font-mono text-white text-xl">{prop.value} <span className="text-sm text-[#8b8fa3]">{prop.unit}</span></p>
                  {prop.test_method && <p className="text-xs font-medium text-[#6366f1] mt-2">{prop.test_method}</p>}
                </div>
              ))}
              {Object.keys(dpp.technical_properties || {}).length === 0 && (
                <p className="text-[#8b8fa3] text-sm italic col-span-2">No technical properties found.</p>
              )}
            </div>
          </div>

          <div className="bg-[#1a1d27]/80 backdrop-blur-sm border border-[#2e3245] rounded-2xl p-8 shadow-lg">
            <h3 className="text-xl font-bold text-white mb-6">Standards Compliance</h3>
            <div className="flex flex-wrap gap-2">
              {(dpp.standards_compliance || []).map((s: string, i: number) => (
                <span key={i} className="bg-[#242736] text-white px-4 py-2 rounded-full text-sm font-medium border border-[#2e3245]">
                  {s}
                </span>
              ))}
              {(!dpp.standards_compliance || dpp.standards_compliance.length === 0) && (
                <p className="text-[#8b8fa3] text-sm italic">No standards listed.</p>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-8 flex flex-col">
          {/* QR Preview */}
          <div className="bg-[#1a1d27]/80 backdrop-blur-sm border border-[#2e3245] rounded-2xl p-8 shadow-lg text-center">
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
            <p className="text-xs text-[#8b8fa3] font-medium">Scan to verify in ConstructAsk</p>
          </div>

          {/* DPP JSON Preview */}
          <div className="bg-[#1a1d27]/80 backdrop-blur-sm border border-[#2e3245] rounded-2xl overflow-hidden flex flex-col flex-1 min-h-[400px] shadow-lg">
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
      <div className="fixed bottom-0 left-0 right-0 md:pl-64 border-t border-[#2e3245] bg-[#0f1117]/90 backdrop-blur-xl p-4 z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4 gap-3">
          <p className="text-[#8b8fa3] text-sm font-medium hidden lg:block">Verify all properties before generating the final passport.</p>
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={downloadJson}
              className="flex items-center bg-[#242736] hover:bg-[#2e3245] text-white px-5 py-3 rounded-full font-bold transition-colors border border-[#2e3245]"
            >
              <Download className="w-4 h-4 mr-2" /> JSON
            </button>
            <button
              onClick={downloadQr}
              className="flex items-center bg-[#242736] hover:bg-[#2e3245] text-white px-5 py-3 rounded-full font-bold transition-colors border border-[#2e3245]"
            >
              <QrCode className="w-4 h-4 mr-2" /> QR
            </button>
            <button
              onClick={handleApprove}
              disabled={loading}
              className="flex items-center bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-gray-200 transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
              {loading ? 'Generating...' : 'Approve & Generate QR'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
