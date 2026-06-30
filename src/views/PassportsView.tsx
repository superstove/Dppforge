import type { ChangeEvent } from 'react';
import { useState, useEffect, useRef } from 'react';
import { Database, Download, Trash2, X, FileJson, Loader2, Search, RefreshCw, FileSpreadsheet, Upload, Check, AlertCircle, Pencil, FileText, ShieldAlert } from 'lucide-react';
import { api, resolveAssetUrl } from '../api';
import { useRole } from '../RoleContext';
import type { PassportSummary, PassportDetail, QualityRecord } from '../types';

export function PassportsView() {
  const { canDelete, canEdit, canApprove, role } = useRole();
  const [passports, setPassports] = useState<PassportSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<PassportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [exporting, setExporting] = useState<'csv' | 'excel' | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ message: string; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState({ product_name: '', manufacturer: '', category: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [ifcExporting, setIfcExporting] = useState(false);
  const [qualityRecords, setQualityRecords] = useState<QualityRecord[]>([]);
  const [qaForm, setQaForm] = useState({ batch_number: '', status: 'passed', tested_by: '', test_date: new Date().toISOString().slice(0, 10), disposition: 'release' });
  const [sourceDocuments, setSourceDocuments] = useState<{ id: number; document_type: string; title: string; issuer: string; file_name: string; file_size: number; rights_status: string; review_status: string; created_at: string }[]>([]);
  const [revisions, setRevisions] = useState<{ id: number; revision_number: number; changed_fields: string[]; changed_by: string; created_at: string }[]>([]);
  const [sourceForm, setSourceForm] = useState({ document_type: 'epd', title: '', issuer: '', file_name: '' });
  const [showAddSource, setShowAddSource] = useState(false);

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
      setPassports(data.items);
      setTotalCount(data.total);
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

  const openDetail = async (id: number) => {
    setSelectedId(id);
    setDetailLoading(true);
    setActionError('');
    try {
      const data = await api.getPassport(id);
      setDetailData(data);
      const [qa, docs, revs] = await Promise.all([
        api.getQualityRecords(id).catch(() => ({ items: [] as QualityRecord[] })),
        api.getSourceDocuments(id).catch(() => ({ items: [] })),
        api.getRevisions(id).catch(() => ({ items: [] })),
      ]);
      setQualityRecords(qa.items);
      setSourceDocuments(docs.items);
      setRevisions(revs.items);
      setQaForm(prev => ({ ...prev, batch_number: data.batch_number || data.dpp_json?.batch_info?.batch_number || '' }));
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to load passport details.');
      setSelectedId(null);
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const createQaRecord = async () => {
    if (!detailData || !qaForm.batch_number.trim()) return;
    try {
      const created = await api.createQualityRecord(detailData.id, {
        ...qaForm,
        results: [{ property: 'reviewed_batch_release', value: qaForm.status, unit: '' }],
      });
      setQualityRecords(prev => [created, ...prev]);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'QA record failed');
    }
  };

  const attachSource = async () => {
    if (!detailData || !sourceForm.document_type.trim()) return;
    try {
      const doc = await api.attachSourceDocument(detailData.id, sourceForm);
      setSourceDocuments(prev => [doc, ...prev]);
      setShowAddSource(false);
      setSourceForm({ document_type: 'epd', title: '', issuer: '', file_name: '' });
      const updated = await api.getPassport(detailData.id);
      setDetailData(updated);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to attach source document');
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetailData(null);
    setDeleteConfirmId(null);
    setEditing(false);
    setShowAddSource(false);
  };

  const startEditing = () => {
    if (!detailData) return;
    setEditFields({
      product_name: detailData.dpp_json?.product_name || detailData.product_name || '',
      manufacturer: detailData.dpp_json?.manufacturer || detailData.manufacturer || '',
      category: detailData.dpp_json?.category || detailData.category || '',
      description: detailData.dpp_json?.description || '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!detailData) return;
    setSaving(true);
    try {
      await api.updatePassport(detailData.id, editFields);
      setEditing(false);
      const updated = await api.getPassport(detailData.id);
      setDetailData(updated);
      setPassports(prev => prev.map(p => p.id === detailData.id ? { ...p, product_name: editFields.product_name, manufacturer: editFields.manufacturer, category: editFields.category } : p));
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handlePdfExport = async (id: number) => {
    setPdfExporting(true);
    try {
      const blob = await api.exportPassportPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DPP-${detailData?.passport_id || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'PDF export failed');
    } finally {
      setPdfExporting(false);
    }
  };

  const handleIfcExport = async (id: number) => {
    setIfcExporting(true);
    try {
      const blob = await api.exportPassportIfc(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DPP-${detailData?.passport_id || id}.ifc`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'IFC export failed');
    } finally {
      setIfcExporting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deletePassport(id);
      setPassports(passports.filter(p => p.id !== id));
      setTotalCount(prev => prev - 1);
      closeDetail();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete passport.');
    }
    setDeleteConfirmId(null);
  };

  const downloadJson = () => {
    if (!detailData?.dpp_json) return;
    const blob = new Blob([JSON.stringify(detailData.dpp_json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dpp-${detailData.passport_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async (format: 'csv' | 'excel') => {
    setExporting(format);
    setActionError('');
    try {
      const blob = format === 'csv' ? await api.exportCsv() : await api.exportExcel();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'csv' ? `dpp-passports.csv` : `dpp-passports.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : `${format.toUpperCase()} export failed`);
    } finally {
      setExporting(null);
    }
  };

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setActionError('');
    try {
      const result = await api.importSpreadsheet(file);
      setImportResult({ message: result.message, errors: result.errors });
      if (result.imported > 0) {
        await fetchPassports();
      }
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
            {totalCount} Records
          </div>
        </div>
      </div>

      {/* Import / Export toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="text-xs font-semibold text-[#63677a] uppercase tracking-wider mr-1">
          <FileSpreadsheet className="w-4 h-4 inline -mt-0.5 mr-1" />Spreadsheet
        </span>
        <button
          onClick={() => handleExport('csv')}
          disabled={exporting !== null || totalCount === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-[#1a1d27] border border-[#2e3245] text-white hover:border-emerald-500/40 hover:text-emerald-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {exporting === 'csv' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Export CSV
        </button>
        <button
          onClick={() => handleExport('excel')}
          disabled={exporting !== null || totalCount === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-[#1a1d27] border border-[#2e3245] text-white hover:border-emerald-500/40 hover:text-emerald-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {exporting === 'excel' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Export Excel
        </button>

        <div className="w-px h-6 bg-[#2e3245] mx-1" />

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleImport}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium bg-[#1a1d27] border border-[#2e3245] text-white hover:border-blue-500/40 hover:text-blue-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Import Spreadsheet
        </button>
      </div>

      {/* Import result banner */}
      {importResult && (
        <div className={`rounded-2xl p-4 mb-6 border ${importResult.errors.length > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
          <div className="flex items-start gap-3">
            {importResult.errors.length > 0 ? (
              <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            ) : (
              <Check className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="text-white font-medium">{importResult.message}</p>
              {importResult.errors.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {importResult.errors.map((err, i) => (
                    <li key={i} className="text-sm text-amber-300/70">{err}</li>
                  ))}
                </ul>
              )}
            </div>
            <button onClick={() => setImportResult(null)} className="text-[#8b8fa3] hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
          <p className="text-[#8b8fa3] text-lg max-w-xl mx-auto mb-6">{error}</p>
          <button
            onClick={fetchPassports}
            className="inline-flex items-center bg-[#242736] hover:bg-[#2e3245] text-white px-6 py-3 rounded-full font-bold transition-colors border border-[#2e3245]"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Retry
          </button>
        </div>
      ) : passports.length === 0 ? (
        <div className="text-center py-20 sm:py-32 px-5 border-2 border-dashed border-[#2e3245] rounded-2xl sm:rounded-[2rem] bg-[#1a1d27]/30">
          <Database className="w-16 h-16 text-[#2e3245] mx-auto mb-6" />
          <h3 className="text-2xl font-bold text-white mb-3">No passports found</h3>
          <p className="text-[#8b8fa3] text-lg max-w-xl mx-auto mb-2">Convert your first Technical Data Sheet or import a spreadsheet to get started.</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-4 inline-flex items-center gap-2 bg-[#242736] hover:bg-[#2e3245] text-white px-6 py-3 rounded-full font-bold transition-colors border border-[#2e3245]"
          >
            <Upload className="w-4 h-4" /> Import from Spreadsheet
          </button>
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

      {/* Detail Modal */}
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                      <QrPanel
                        title="DPP QR"
                        subtitle="Opens the DPP Forge public passport"
                        imageUrl={detailData.qr_code_url}
                        linkUrl={detailData.qr_code_url}
                        alt="DPP QR Code"
                      />
                      <QrPanel
                        title="ConstructAsk QR"
                        subtitle="Redirects to ConstructAsk verification"
                        imageUrl={detailData.constructask_qr_code_url}
                        linkUrl={detailData.constructask_qr_code_url}
                        alt="ConstructAsk QR Code"
                      />
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
                    <div className="mb-5 bg-[#242736]/60 border border-[#2e3245] rounded-2xl p-4">
                      <div className="flex flex-col gap-3 mb-3 sm:flex-row sm:items-end">
                        <div className="flex-1">
                          <label className="text-xs font-semibold text-[#8b8fa3] uppercase tracking-wider mb-1 block">Batch QA/QC</label>
                          <input value={qaForm.batch_number} onChange={e => setQaForm(prev => ({ ...prev, batch_number: e.target.value }))} placeholder="Batch number" className="w-full bg-[#0f1117] border border-[#2e3245] rounded-xl px-3 py-2 text-sm text-white" />
                        </div>
                        <select value={qaForm.status} onChange={e => setQaForm(prev => ({ ...prev, status: e.target.value }))} className="bg-[#0f1117] border border-[#2e3245] rounded-xl px-3 py-2 text-sm text-white">
                          <option value="passed">Passed</option>
                          <option value="pending">Pending</option>
                          <option value="failed">Failed</option>
                          <option value="quarantined">Quarantined</option>
                        </select>
                        <input value={qaForm.tested_by} onChange={e => setQaForm(prev => ({ ...prev, tested_by: e.target.value }))} placeholder="Inspector" className="bg-[#0f1117] border border-[#2e3245] rounded-xl px-3 py-2 text-sm text-white" />
                        <button onClick={createQaRecord} className="bg-white text-black px-4 py-2 rounded-xl text-sm font-bold">Add QA</button>
                      </div>
                      {qualityRecords.length > 0 ? (
                        <div className="space-y-2 mt-2">
                          {qualityRecords.map(record => {
                            const statusColor = record.status === 'passed' ? 'text-green-400 border-green-500/30 bg-green-500/10'
                              : record.status === 'failed' ? 'text-red-400 border-red-500/30 bg-red-500/10'
                              : record.status === 'quarantined' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
                              : 'text-[#8b8fa3] border-[#2e3245] bg-[#0f1117]';
                            return (
                              <div key={record.id} className={`rounded-xl border p-3 ${statusColor}`}>
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <span className="font-bold text-sm">{record.batch_number}</span>
                                  <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded-full border border-current">{record.status}</span>
                                  {record.disposition && <span className="text-xs opacity-70">Disposition: {record.disposition}</span>}
                                </div>
                                <div className="flex flex-wrap gap-3 text-xs opacity-80">
                                  {record.tested_by && <span>Inspector: {record.tested_by}</span>}
                                  {record.test_date && <span>Date: {record.test_date}</span>}
                                  {record.results && record.results.length > 0 && (
                                    <span>{record.results.length} test result{record.results.length > 1 ? 's' : ''}</span>
                                  )}
                                </div>
                                {record.notes && <p className="text-xs mt-1 opacity-70">{record.notes}</p>}
                                <a href={`/api/passports/${detailData.id}/batch/${encodeURIComponent(record.batch_number)}/qr`} target="_blank" rel="noreferrer" className="inline-block mt-2 text-xs underline opacity-70 hover:opacity-100">
                                  Download Batch QR
                                </a>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-[#63677a] mt-2">No QA records yet. Add a batch quality check above.</p>
                      )}
                    </div>
                    {/* Source Documents — multi-document linking */}
                    <div className="mb-5 bg-[#242736]/60 border border-[#2e3245] rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-xs font-semibold text-[#8b8fa3] uppercase tracking-wider">Linked Source Documents</label>
                        <button onClick={() => setShowAddSource(!showAddSource)} className="text-xs px-3 py-1 rounded-lg bg-[#0f1117] border border-[#2e3245] text-[#c0c4d6] hover:text-white">
                          {showAddSource ? 'Cancel' : '+ Attach Document'}
                        </button>
                      </div>
                      {showAddSource && (
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <select value={sourceForm.document_type} onChange={e => setSourceForm(prev => ({ ...prev, document_type: e.target.value }))} className="bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-xs text-white">
                            <option value="tds">TDS</option>
                            <option value="epd">EPD</option>
                            <option value="dop">DoP</option>
                            <option value="test_report">Test Report</option>
                            <option value="sds">SDS</option>
                            <option value="certificate">Certificate</option>
                          </select>
                          <input value={sourceForm.title} onChange={e => setSourceForm(prev => ({ ...prev, title: e.target.value }))} placeholder="Document title" className="bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-xs text-white" />
                          <input value={sourceForm.issuer} onChange={e => setSourceForm(prev => ({ ...prev, issuer: e.target.value }))} placeholder="Issuer" className="bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-xs text-white" />
                          <button onClick={attachSource} className="bg-white text-black px-3 py-2 rounded-lg text-xs font-bold">Attach</button>
                        </div>
                      )}
                      {/* Primary source from DPP */}
                      {detailData.dpp_json?.source_document && (
                        <div className="rounded-lg bg-[#0f1117] border border-blue-500/30 p-3 text-xs mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-blue-400 font-semibold">{detailData.dpp_json.source_document.type || detailData.dpp_json.source_document.document_type_code?.toUpperCase()}</span>
                            <span className="text-[10px] uppercase text-blue-300">Primary</span>
                          </div>
                          <div className="text-white">{detailData.dpp_json.source_document.document_title || detailData.dpp_json.source_document.title}</div>
                          {detailData.dpp_json.source_document.issuer && <div className="text-[#8b8fa3] mt-0.5">Issuer: {detailData.dpp_json.source_document.issuer}</div>}
                        </div>
                      )}
                      {/* Additional linked source documents */}
                      {sourceDocuments.map(doc => (
                        <div key={doc.id} className="rounded-lg bg-[#0f1117] border border-[#2e3245] p-3 text-xs mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[#c0c4d6] font-semibold">{doc.document_type.toUpperCase()}</span>
                            <span className={`text-[10px] uppercase font-semibold ${doc.review_status === 'approved' ? 'text-green-400' : 'text-yellow-400'}`}>{doc.review_status}</span>
                          </div>
                          <div className="text-white">{doc.title || doc.file_name}</div>
                          {doc.issuer && <div className="text-[#8b8fa3] mt-0.5">Issuer: {doc.issuer}</div>}
                          {doc.file_size > 0 && <div className="text-[#63677a] mt-0.5">File: {doc.file_name} ({(doc.file_size / 1024).toFixed(1)} KB)</div>}
                        </div>
                      ))}
                      {sourceDocuments.length === 0 && !detailData.dpp_json?.source_document && (
                        <p className="text-xs text-[#63677a]">No source documents linked. Attach TDS, EPD, DoP, or test reports.</p>
                      )}
                    </div>

                    {/* Revision History */}
                    {revisions.length > 0 && (
                      <div className="mb-5 bg-[#242736]/60 border border-[#2e3245] rounded-2xl p-4">
                        <label className="text-xs font-semibold text-[#8b8fa3] uppercase tracking-wider mb-3 block">Revision History</label>
                        <div className="space-y-2">
                          {revisions.map(rev => (
                            <div key={rev.id} className="rounded-lg bg-[#0f1117] border border-[#2e3245] p-3 text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-white font-semibold">Rev {rev.revision_number}</span>
                                <span className="text-[#63677a]">{new Date(rev.created_at).toLocaleDateString()}</span>
                              </div>
                              <div className="text-[#8b8fa3]">
                                Changed: {rev.changed_fields.map(f => f.replace(/_/g, ' ')).join(', ')}
                              </div>
                              <div className="text-[#63677a] mt-0.5">By: {rev.changed_by}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

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

                <div className="flex flex-wrap justify-between items-center p-6 border-t border-[#2e3245] bg-[#0f1117] gap-3">
                  <div className="flex gap-2">
                    {canDelete ? (
                      <button onClick={() => setDeleteConfirmId(detailData.id)} className="flex items-center text-[#ef4444] hover:bg-[#ef4444]/10 px-4 py-2.5 rounded-full font-medium transition-colors text-sm">
                        <Trash2 className="w-4 h-4 mr-1.5" /> Delete
                      </button>
                    ) : (
                      <span className="flex items-center text-[#63677a] px-4 py-2.5 text-sm" title="Only Admin role can delete passports">
                        <ShieldAlert className="w-4 h-4 mr-1.5" /> Delete (Admin only)
                      </span>
                    )}
                    {canEdit ? (
                      <button onClick={startEditing} className="flex items-center text-blue-400 hover:bg-blue-500/10 px-4 py-2.5 rounded-full font-medium transition-colors text-sm">
                        <Pencil className="w-4 h-4 mr-1.5" /> Edit
                      </button>
                    ) : (
                      <span className="flex items-center text-[#63677a] px-4 py-2.5 text-sm" title="Reviewers cannot edit — switch to Engineer or Admin role">
                        <Pencil className="w-4 h-4 mr-1.5" /> Edit (Engineer/Admin)
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePdfExport(detailData.id)}
                      disabled={pdfExporting}
                      className="flex items-center bg-[#242736] text-white px-5 py-2.5 rounded-full font-medium hover:bg-[#2e3245] transition-colors text-sm border border-[#2e3245] disabled:opacity-50"
                    >
                      {pdfExporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileText className="w-4 h-4 mr-1.5" />} PDF
                    </button>
                    <button
                      onClick={() => handleIfcExport(detailData.id)}
                      disabled={ifcExporting}
                      className="flex items-center bg-[#242736] text-white px-5 py-2.5 rounded-full font-medium hover:bg-[#2e3245] transition-colors text-sm border border-[#2e3245] disabled:opacity-50"
                    >
                      {ifcExporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Database className="w-4 h-4 mr-1.5" />} IFC
                    </button>
                    <button onClick={downloadJson} className="flex items-center bg-white text-black px-6 py-2.5 rounded-full font-bold hover:bg-gray-200 transition-colors text-sm shadow-lg">
                      <Download className="w-4 h-4 mr-1.5" /> JSON
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && detailData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1a1d27] border border-blue-500/30 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Pencil className="w-5 h-5 text-blue-400" /> Edit Passport
            </h3>
            <div className="space-y-4">
              {(['product_name', 'manufacturer', 'category', 'description'] as const).map(field => (
                <div key={field}>
                  <label className="text-xs font-semibold text-[#8b8fa3] uppercase tracking-wider mb-1.5 block">
                    {field.replace('_', ' ')}
                  </label>
                  {field === 'description' ? (
                    <textarea
                      value={editFields[field]}
                      onChange={e => setEditFields(prev => ({ ...prev, [field]: e.target.value }))}
                      rows={3}
                      className="w-full bg-[#0f1117] border border-[#2e3245] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={editFields[field]}
                      onChange={e => setEditFields(prev => ({ ...prev, [field]: e.target.value }))}
                      className="w-full bg-[#0f1117] border border-[#2e3245] rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditing(false)}
                className="flex-1 bg-[#242736] hover:bg-[#2e3245] text-white py-3 rounded-full font-bold transition-colors border border-[#2e3245]"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-full font-bold transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1a1d27] border border-[#ef4444]/30 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <div className="w-14 h-14 bg-[#ef4444]/10 rounded-full flex items-center justify-center mx-auto mb-5">
              <Trash2 className="w-7 h-7 text-[#ef4444]" />
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-2">Delete this passport?</h3>
            <p className="text-[#8b8fa3] text-center mb-8">This action cannot be undone. The DPP record and its QR code will be permanently removed.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 bg-[#242736] hover:bg-[#2e3245] text-white py-3 rounded-full font-bold transition-colors border border-[#2e3245]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white py-3 rounded-full font-bold transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono = false, capitalize = false }: { label: string; value: string; mono?: boolean; capitalize?: boolean }) {
  return (
    <div className="flex justify-between items-center border-b border-[#2e3245] pb-3 last:border-0 last:pb-0">
      <span className="text-[#8b8fa3] text-sm font-medium">{label}</span>
      <span className={`text-white text-sm text-right ${mono ? 'font-mono bg-[#0f1117] px-2 py-0.5 rounded border border-[#2e3245] text-xs' : 'font-semibold'} ${capitalize ? 'capitalize' : ''}`}>{value || 'N/A'}</span>
    </div>
  );
}

function QrPanel({
  title,
  subtitle,
  imageUrl,
  linkUrl,
  alt,
}: {
  title: string;
  subtitle: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  alt: string;
}) {
  const resolvedImage = resolveAssetUrl(imageUrl);
  const resolvedLink = resolveAssetUrl(linkUrl);

  return (
    <div className="bg-[#0f1117] p-5 rounded-2xl border border-[#2e3245] text-center shadow-inner">
      {resolvedImage ? (
        <a href={resolvedLink || resolvedImage} target="_blank" rel="noreferrer" className="bg-white p-3 rounded-2xl inline-block mb-4 shadow-lg hover:ring-2 hover:ring-white/30 transition-all">
          <img src={resolvedImage} className="w-36 h-36 sm:w-40 sm:h-40" alt={alt} />
        </a>
      ) : (
        <div className="w-40 h-40 mx-auto mb-4 rounded-2xl border border-dashed border-[#2e3245] bg-[#1a1d27] flex items-center justify-center text-xs text-[#63677a]">
          Not generated
        </div>
      )}
      <p className="text-xs font-bold text-white uppercase tracking-wider">{title}</p>
      <p className="text-[11px] text-[#8b8fa3] mt-1">{subtitle}</p>
      {resolvedLink && (
        <a href={resolvedLink} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-[11px] font-semibold text-blue-300 hover:text-blue-200 underline underline-offset-4">
          Open QR image
        </a>
      )}
    </div>
  );
}
