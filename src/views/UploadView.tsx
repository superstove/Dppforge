import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { ArrowLeft, Loader2, FileUp } from 'lucide-react';
import { api } from '../api';
import type { ConversionResult, ViewName } from '../types';

interface UploadViewProps {
  setView: (v: ViewName) => void;
  onReview: (data: ConversionResult) => void;
}

export function UploadView({ setView, onReview }: UploadViewProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setError('');
    } else {
      setError("Please upload a PDF file.");
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.convertUpload(file);
      onReview(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed. Check backend connection and PDF format.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:p-8 flex flex-col min-h-full">
      <button onClick={() => setView('home')} className="flex items-center text-[#8b8fa3] hover:text-white mb-8 transition-colors font-medium self-start">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
      </button>
      
      <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">Upload PDF</h2>
      <p className="text-[#8b8fa3] mb-8 sm:mb-10 text-base sm:text-lg leading-relaxed">Our AI will automatically extract Technical Data Sheet properties into a structured format.</p>
      {error && (
        <div className="mb-8 rounded-2xl border border-[#ef4444]/30 bg-[#ef4444]/10 p-5 text-[#fecaca] font-medium">
          {error}
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center mb-10">
        <div 
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => !loading && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed ${file ? 'border-white bg-white/5' : 'border-[#2e3245] bg-[#1a1d27]/50'} rounded-2xl sm:rounded-[2rem] p-6 sm:p-16 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#1a1d27] hover:border-white/50 transition-all duration-300 min-h-[280px] sm:min-h-[400px] overflow-hidden`}
        >
          {loading && (
             <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-10">
               <Loader2 className="w-12 h-12 sm:w-16 sm:h-16 text-white animate-spin mb-6" />
               <p className="text-xl sm:text-2xl text-white font-bold tracking-tight">Extracting Data...</p>
               <p className="text-[#8b8fa3] mt-2 font-medium">This may take a few seconds.</p>
             </div>
          )}

          <input type="file" ref={fileInputRef} onChange={handleChange} accept=".pdf" className="hidden" />
          
          <div className={`bg-[#242736] w-16 h-16 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-6 sm:mb-8 border ${file ? 'border-white' : 'border-[#2e3245]'} shadow-2xl`}>
             <FileUp className={`w-8 h-8 sm:w-10 sm:h-10 ${file ? 'text-white' : 'text-[#8b8fa3]'}`} />
          </div>

          <h3 className="text-xl sm:text-3xl font-bold text-white mb-3 max-w-full break-words">
            {file ? file.name : "Drag & drop PDF here"}
          </h3>
          <p className="text-[#8b8fa3] text-sm sm:text-lg">
            {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "or click to browse from your computer. Max 10MB."}
          </p>
        </div>
      </div>

      <div className="flex justify-stretch sm:justify-end pb-8">
        <button 
          onClick={handleUpload}
          disabled={!file || loading}
          className="w-full sm:w-auto bg-white text-black px-10 py-4 rounded-full font-bold text-base sm:text-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xl"
        >
          Extract Data
        </button>
      </div>
    </div>
  );
}
