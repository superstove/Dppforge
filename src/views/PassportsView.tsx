import { useState, useEffect } from 'react';
import { Database, Download, Trash2, X, FileJson, Loader2, Search } from 'lucide-react';
import { api, resolveAssetUrl } from '../api';

export function PassportsView() {
  const [passports, setPassports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const filteredPassports = passports.filter((passport) => {
    const haystack = [
      passport.passport_id,
      passport.product_name,
      passport.manufacturer,
      passport.category,
      passport.batch_number,
    ].join(' ').toLowerCase();
    return haystack.includes(searchQuery.trim().toLowerCase());
  });

  const fetchPassports = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getPassports();
      setPassports(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setPassports([]);
      setError(err instanceof Error ? err.message : 'Could not load saved passports. Check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPassports();
  }, []);

  const openDetail = async (id: string | number) => {
    setSelectedId(id);
    setDetailLoading(true);
    setActionError('');
    try {
      const data = await api.getPassport(id);
      setDetailData(data);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to load passport details.');
      setSelectedId(null);
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetailData(null);
  };

  const handleDelete = async (id: string | number) => {
    if (!confirm("Are you sure you want to delete this passport?")) return;
    try {
      await api.deletePassport(id);
      setPassports(passports.filter(p => p.id !== id));
      closeDetail();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete passport.');
    }
  };

  const downloadJson = () => {
    if (!detailData?.dpp_json) return;
    const blob = new Blob([JSON.stringify(detailData.dpp_json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dpp-${detailData.passport_id}.json`;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:p-8 pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 sm:mb-10 gap-4">
        <div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2">Saved Passports</h2>
          <p className="text-[#8b8fa3] font-medium">Manage your generated Digital Product Passports.</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:space-x-4 sm:gap-0 w-full md:w-auto">
          <div className="relative flex-1 md:w-64 w-full">
             <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8b8fa3]" />
             <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search ID or Name..."
              className="w-full bg-[#1a1d27] border border-[#2e3245] rounded-full pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-white transition-colors"
            />
          </div>
          <div className="bg-[#1a1d27] border border-[#2e3245] px-5 py-2 rounded-full text-sm font-bold text-white self-start sm:self-auto">
            {filteredPassports.length} Records
          </div>
        </div>
      </div>

      {actionError && (
        <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-2xl p-4 mb-6 text-[#fecaca] font-medium">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-32"><Loader2 className="w-10 h-10 text-white animate-spin" /></div>
      ) : error ? (
        <div className="text-center py-20 sm:py-32 px-5 border-2 border-dashed border-[#ef4444]/30 rounded-2xl sm:rounded-[2rem] bg-[#ef4444]/5">
          <Database className="w-16 h-16 text-[#ef4444]/50 mx-auto mb-6" />
          <h3 className="text-2xl font-bold text-white mb-3">Registry unavailable</h3>
          <p className="text-[#8b8fa3] text-lg max-w-xl mx-auto">{error}</p>
        </div>
      ) : passports.length === 0 ? (
        <div className="text-center py-20 sm:py-32 px-5 border-2 border-dashed border-[#2e3245] rounded-2xl sm:rounded-[2rem] bg-[#1a1d27]/30">
          <Database className="w-16 h-16 text-[#2e3245] mx-auto mb-6" />
          <h3 className="text-2xl font-bold text-white mb-3">No passports found</h3>
          <p className="text-[#8b8fa3] text-lg max-w-xl mx-auto">Convert your first Technical Data Sheet to get started. For a polished demo, keep one approved sample record in Supabase.</p>
        </div>
      ) : filteredPassports.length === 0 ? (
        <div className="text-center py-20 sm:py-32 px-5 border-2 border-dashed border-[#2e3245] rounded-2xl sm:rounded-[2rem] bg-[#1a1d27]/30">
          <Search className="w-16 h-16 text-[#2e3245] mx-auto mb-6" />
          <h3 className="text-2xl font-bold text-white mb-3">No matching passports</h3>
          <p className="text-[#8b8fa3] text-lg">Try another product name, manufacturer, category, or passport ID.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredPassports.map(p => (
            <div 
              key={p.id} 
              onClick={() => openDetail(p.id)}
              className="bg-[#1a1d27]/80 backdrop-blur-sm border border-[#2e3245] hover:border-white/50 rounded-2xl p-5 sm:p-6 cursor-pointer transition-all duration-300 hover:-translate-y-1 group shadow-lg"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="pr-4">
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-1 group-hover:text-white transition-colors line-clamp-1">{p.product_name}</h3>
                  <p className="text-sm font-medium text-[#8b8fa3]">{p.manufacturer}</p>
                </div>
                {p.qr_code_url ? (
                  <div className="bg-white p-1.5 rounded-lg shadow-sm flex-shrink-0">
                    <img src={resolveAssetUrl(p.qr_code_url)} className="w-10 h-10" alt="QR" />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-[#242736] rounded-lg border border-[#2e3245] flex-shrink-0"></div>
                )}
              </div>
              <div className="space-y-3 mb-6 bg-[#242736]/50 p-4 rounded-xl border border-[#2e3245]/50">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#8b8fa3] font-medium">ID</span>
                  <span className="text-white font-mono bg-[#0f1117] px-2 py-0.5 rounded border border-[#2e3245] text-[10px] sm:text-xs break-all text-right">{p.passport_id}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#8b8fa3] font-medium">Category</span>
                  <span className="text-white font-medium">{p.category || 'N/A'}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-4 border-t border-[#2e3245]">
                <span className="text-xs px-2.5 py-1 bg-[#0f1117] text-white font-medium rounded-full border border-[#2e3245] capitalize">{p.conversion_method}</span>
                <span className="text-xs px-2.5 py-1 bg-[#0f1117] text-[#8b8fa3] font-medium rounded-full border border-[#2e3245]">{p.properties_count || 0} props</span>
                <span className="text-xs px-2.5 py-1 bg-[#0f1117] text-[#8b8fa3] font-medium rounded-full border border-[#2e3245]">{p.standards_count || 0} stds</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-md">
          <div className="bg-[#1a1d27] border border-[#2e3245] rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {detailLoading || !detailData ? (
              <div className="flex justify-center items-center h-96">
                <Loader2 className="w-10 h-10 text-white animate-spin" />
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start gap-4 p-5 sm:p-8 border-b border-[#2e3245] bg-[#0f1117]">
                  <h3 className="text-xl sm:text-3xl font-bold text-white break-words">{detailData.product_name}</h3>
                  <button onClick={closeDetail} className="text-[#8b8fa3] hover:text-white bg-[#242736] hover:bg-[#2e3245] p-2 rounded-full transition-colors border border-[#2e3245]">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-5 sm:p-8 flex flex-col lg:flex-row gap-6 sm:gap-8 bg-[#1a1d27]">
                  <div className="lg:w-1/3 space-y-6">
                    <div className="bg-[#0f1117] p-5 sm:p-8 rounded-2xl border border-[#2e3245] text-center shadow-inner">
                      <div className="bg-white p-3 rounded-2xl inline-block mb-4 shadow-lg">
                        <img src={resolveAssetUrl(detailData.qr_code_url)} className="w-40 h-40" alt="QR Code" />
                      </div>
                      <p className="text-xs font-bold text-white uppercase tracking-wider">ConstructAsk Verify</p>
                    </div>

                    <div className="space-y-4 bg-[#242736]/50 p-5 sm:p-6 rounded-2xl border border-[#2e3245]">
                      <DetailRow label="Passport ID" value={detailData.passport_id} mono />
                      <DetailRow label="Manufacturer" value={detailData.manufacturer} />
                      <DetailRow label="Category" value={detailData.category} />
                      <DetailRow label="Batch" value={detailData.batch_number} />
                      <DetailRow label="Method" value={detailData.conversion_method} capitalize />
                      <DetailRow label="Created" value={detailData.created_at} />
                    </div>
                  </div>

                  <div className="lg:w-2/3 flex flex-col h-full min-h-[400px]">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center">
                      <FileJson className="w-5 h-5 mr-2" /> Digital Product Passport JSON
                    </h4>
                    <div className="flex-1 bg-[#0a0b10] border border-[#2e3245] rounded-2xl p-4 sm:p-6 overflow-auto custom-scrollbar shadow-inner">
                      <pre className="text-xs font-mono text-[#e4e6ed] whitespace-pre-wrap leading-relaxed">
                        {JSON.stringify(detailData.dpp_json, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center p-6 border-t border-[#2e3245] bg-[#0f1117] gap-4">
                  <button onClick={() => handleDelete(detailData.id)} className="flex items-center text-[#ef4444] hover:bg-[#ef4444]/10 px-6 py-3 rounded-full font-bold transition-colors w-full sm:w-auto justify-center">
                    <Trash2 className="w-5 h-5 mr-2" /> Delete Record
                  </button>
                  <button onClick={downloadJson} className="flex items-center bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-gray-200 transition-colors w-full sm:w-auto justify-center shadow-lg">
                    <Download className="w-5 h-5 mr-2" /> Download JSON
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono = false, capitalize = false }: { label: string, value: string, mono?: boolean, capitalize?: boolean }) {
  return (
    <div className="flex justify-between items-center border-b border-[#2e3245] pb-3 last:border-0 last:pb-0">
      <span className="text-[#8b8fa3] text-sm font-medium">{label}</span>
      <span className={`text-white text-sm text-right ${mono ? 'font-mono bg-[#0f1117] px-2 py-0.5 rounded border border-[#2e3245] text-xs' : 'font-semibold'} ${capitalize ? 'capitalize' : ''}`}>{value || 'N/A'}</span>
    </div>
  );
}
