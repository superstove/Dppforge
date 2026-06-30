import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { ArrowLeft, Loader2, FileUp, Files, X, Check, AlertCircle, ShieldAlert } from 'lucide-react';
import { api } from '../api';
import { useRole } from '../RoleContext';
import type { ConversionResult } from '../types';

interface UploadViewProps {
  setView: (v: string) => void;
  onReview: (data: ConversionResult) => void;
}

const DOC_TYPES = [
  { value: 'auto', label: 'Auto Detect' },
  { value: 'tds', label: 'Technical Data Sheet (TDS)' },
  { value: 'epd', label: 'Environmental Product Declaration (EPD)' },
  { value: 'dop', label: 'Declaration of Performance (DoP)' },
  { value: 'test_report', label: 'Test Report / Lab Certificate' },
  { value: 'sds', label: 'Safety Data Sheet (SDS)' },
  { value: 'fpc', label: 'Factory Production Control' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'installation', label: 'Installation' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'end_of_life', label: 'End of Life' },
  { value: 'catalogue', label: 'Catalogue' },
];

type BatchResult = { file: string; status: string; detail?: string; extracted_dpp?: Record<string, unknown>; warnings?: string[] };

export function UploadView({ setView, onReview }: UploadViewProps) {
  const { canCreate } = useRole();
  const [files, setFiles] = useState<File[]>([]);
  const [docType, setDocType] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [batchResults, setBatchResults] = useState<BatchResult[] | null>(null);
  const [draftResult, setDraftResult] = useState<ConversionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBatch = files.length > 1;

  const addFiles = (newFiles: FileList | File[]) => {
    const pdfs = Array.from(newFiles).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) {
      setError('Please upload PDF files only.');
      return;
    }
    setFiles(prev => [...prev, ...pdfs]);
    setError('');
    setBatchResults(null);
    setDraftResult(null);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setBatchResults(null);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError('');
    setBatchResults(null);

    try {
      if (files.length === 1) {
        const res = await api.convertUpload(files[0], docType);
        if ((res.drafts?.length || 0) > 1) {
          setDraftResult(res);
        } else {
          onReview(res);
        }
      } else {
        const res = await api.batchUpload(files, docType);
        setBatchResults(res.results as unknown as BatchResult[]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')) {
        setError('Cannot reach the server. It may be waking up (free tier takes ~30s). Please wait a moment and try again.');
      } else {
        setError(msg || 'Upload failed. Check backend connection and PDF format.');
      }
    } finally {
      setLoading(false);
    }
  };

  const reviewBatchItem = (item: BatchResult) => {
    if (item.status !== 'review_required') return;
    onReview(item as unknown as ConversionResult);
  };

  const reviewDraft = (draftIndex: number) => {
    if (!draftResult?.drafts) return;
    onReview({ ...draftResult, extracted_dpp: draftResult.drafts[draftIndex] });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:p-8 flex flex-col min-h-full">
      <button onClick={() => setView('home')} className="flex items-center text-[#8b8fa3] hover:text-white mb-8 transition-colors font-medium self-start">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
      </button>

      <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">Upload Document</h2>
      <p className="text-[#8b8fa3] mb-4 text-base sm:text-lg leading-relaxed">Upload a TDS, EPD, DoP, or Test Report — our AI extracts properties into a structured DPP. Supports single or batch upload.</p>

      {/* Document type selector */}
      <div className="flex flex-wrap gap-2 mb-8">
        {DOC_TYPES.map(dt => (
          <button
            key={dt.value}
            onClick={() => setDocType(dt.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              docType === dt.value
                ? 'bg-white text-black'
                : 'bg-[#1a1d27] text-[#8b8fa3] border border-[#2e3245] hover:text-white hover:border-[#4e5269]'
            }`}
          >
            {dt.label}
          </button>
        ))}
      </div>
      {error && (
        <div className="mb-8 rounded-2xl border border-[#ef4444]/30 bg-[#ef4444]/10 p-5 text-[#fecaca] font-medium">
          {error}
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center mb-6">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => !loading && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed ${files.length > 0 ? 'border-white bg-white/5' : 'border-[#2e3245] bg-[#1a1d27]/50'} rounded-2xl sm:rounded-[2rem] p-6 sm:p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#1a1d27] hover:border-white/50 transition-all duration-300 min-h-[200px] sm:min-h-[300px] overflow-hidden`}
        >
          {loading && (
             <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-10">
               <Loader2 className="w-12 h-12 sm:w-16 sm:h-16 text-white animate-spin mb-6" />
               <p className="text-xl sm:text-2xl text-white font-bold tracking-tight">
                 {isBatch ? `Processing ${files.length} files...` : 'Extracting Data...'}
               </p>
               <p className="text-[#8b8fa3] mt-2 font-medium">This may take a few seconds per file.</p>
             </div>
          )}

          <input type="file" ref={fileInputRef} onChange={handleChange} accept=".pdf" multiple className="hidden" />

          <div className={`bg-[#242736] w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-4 sm:mb-6 border ${files.length > 0 ? 'border-white' : 'border-[#2e3245]'} shadow-2xl`}>
             {files.length > 1 ? (
               <Files className={`w-8 h-8 sm:w-10 sm:h-10 ${files.length > 0 ? 'text-white' : 'text-[#8b8fa3]'}`} />
             ) : (
               <FileUp className={`w-8 h-8 sm:w-10 sm:h-10 ${files.length > 0 ? 'text-white' : 'text-[#8b8fa3]'}`} />
             )}
          </div>

          <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
            {files.length === 0 ? 'Drag & drop PDFs here' : `${files.length} file${files.length > 1 ? 's' : ''} selected`}
          </h3>
          <p className="text-[#8b8fa3] text-sm sm:text-base">
            {files.length === 0 ? 'Click to browse. Select multiple files for batch upload. Max 10MB each.' : 'Click to add more files'}
          </p>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mb-6 space-y-2">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center gap-3 bg-[#1a1d27] border border-[#2e3245] rounded-xl px-4 py-3">
              <FileUp className="w-4 h-4 text-[#8b8fa3] flex-shrink-0" />
              <span className="text-sm text-white font-medium flex-1 truncate">{f.name}</span>
              <span className="text-xs text-[#63677a]">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
              <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="text-[#8b8fa3] hover:text-[#ef4444] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Batch results */}
      {batchResults && (
        <div className="mb-6 space-y-2">
          <h3 className="text-sm font-semibold text-[#63677a] uppercase tracking-wider mb-3">
            Batch Results — {batchResults.filter(r => r.status === 'review_required').length} succeeded, {batchResults.filter(r => r.status === 'error').length} failed
          </h3>
          {batchResults.map((r, i) => (
            <div
              key={i}
              onClick={() => reviewBatchItem(r)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                r.status === 'review_required'
                  ? 'bg-emerald-500/10 border-emerald-500/20 cursor-pointer hover:border-emerald-500/40'
                  : 'bg-[#ef4444]/10 border-[#ef4444]/20'
              }`}
            >
              {r.status === 'review_required' ? (
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-[#ef4444] flex-shrink-0" />
              )}
              <span className="text-sm text-white font-medium flex-1 truncate">{r.file}</span>
              <span className={`text-xs font-medium ${r.status === 'review_required' ? 'text-emerald-400' : 'text-[#ef4444]'}`}>
                {r.status === 'review_required' ? 'Click to review' : r.detail || 'Failed'}
              </span>
            </div>
          ))}
        </div>
      )}

      {draftResult?.drafts && draftResult.drafts.length > 1 && (
        <div className="mb-6 space-y-2">
          <h3 className="text-sm font-semibold text-[#63677a] uppercase tracking-wider mb-3">
            Detected {draftResult.product_count || draftResult.drafts.length} products in {draftResult.detected_document_type?.toUpperCase() || 'document'}
          </h3>
          {draftResult.drafts.map((draft, index) => (
            <button
              key={`${draft.passport_id}-${index}`}
              onClick={() => reviewDraft(index)}
              className="w-full flex items-center gap-3 rounded-xl px-4 py-3 border bg-[#1a1d27] border-[#2e3245] hover:border-white/40 text-left transition-colors"
            >
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="text-sm text-white font-medium flex-1 truncate">{draft.product_name}</span>
              <span className="text-xs text-[#8b8fa3]">{draft.manufacturer || 'Unknown manufacturer'}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-stretch sm:justify-end pb-8">
        {canCreate ? (
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || loading}
            className="w-full sm:w-auto bg-white text-black px-10 py-4 rounded-full font-bold text-base sm:text-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xl"
          >
            {files.length > 1 ? `Extract ${files.length} Files` : 'Extract Data'}
          </button>
        ) : (
          <div className="flex items-center gap-2 text-[#63677a] text-sm">
            <ShieldAlert className="w-5 h-5" />
            <span>Switch to Engineer or Admin role to create new passports</span>
          </div>
        )}
      </div>
    </div>
  );
}
