import { useState, useRef } from 'react';
import { ArrowLeft, Loader2, FileUp } from 'lucide-react';
import { api } from '../api';

export function UploadView({ setView, onReview }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: any) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
    } else {
      alert("Please upload a PDF file.");
    }
  };

  const handleChange = (e: any) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) setFile(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await api.convertUpload(file);
      onReview(res);
    } catch (err) {
      alert("Upload failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8 flex flex-col min-h-full">
      <button onClick={() => setView('home')} className="flex items-center text-[#8b8fa3] hover:text-white mb-8 transition-colors font-medium self-start">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
      </button>
      
      <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">Upload PDF</h2>
      <p className="text-[#8b8fa3] mb-10 text-lg">Our AI will automatically extract Technical Data Sheet properties into a structured format.</p>

      <div className="flex-1 flex flex-col justify-center mb-10">
        <div 
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => !loading && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed ${file ? 'border-white bg-white/5' : 'border-[#2e3245] bg-[#1a1d27]/50'} rounded-[2rem] p-16 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#1a1d27] hover:border-white/50 transition-all duration-300 min-h-[400px] overflow-hidden`}
        >
          {loading && (
             <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-10">
               <Loader2 className="w-16 h-16 text-white animate-spin mb-6" />
               <p className="text-2xl text-white font-bold tracking-tight">Extracting Data...</p>
               <p className="text-[#8b8fa3] mt-2 font-medium">This may take a few seconds.</p>
             </div>
          )}

          <input type="file" ref={fileInputRef} onChange={handleChange} accept=".pdf" className="hidden" />
          
          <div className={`bg-[#242736] w-24 h-24 rounded-3xl flex items-center justify-center mb-8 border ${file ? 'border-white' : 'border-[#2e3245]'} shadow-2xl`}>
             <FileUp className={`w-10 h-10 ${file ? 'text-white' : 'text-[#8b8fa3]'}`} />
          </div>

          <h3 className="text-3xl font-bold text-white mb-3">
            {file ? file.name : "Drag & drop PDF here"}
          </h3>
          <p className="text-[#8b8fa3] text-lg">
            {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "or click to browse from your computer. Max 10MB."}
          </p>
        </div>
      </div>

      <div className="flex justify-end pb-8">
        <button 
          onClick={handleUpload}
          disabled={!file || loading}
          className="bg-white text-black px-10 py-4 rounded-full font-bold text-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xl"
        >
          Extract Data
        </button>
      </div>
    </div>
  );
}
