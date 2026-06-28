import { FileText, Upload } from 'lucide-react';

export function HomeView({ setView }: { setView: (v: string) => void }) {
  return (
    <div className="relative min-h-[calc(100svh-4rem)] flex flex-col items-center justify-center px-4 py-8 sm:p-8 overflow-hidden bg-black">
      {/* Background glow resembling Grok's landing page */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[100vw] h-[70vh] bg-[#7fa6ff]/10 blur-[150px] rounded-[100%] mix-blend-screen"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] w-[60vw] h-[50vh] bg-white/15 blur-[120px] rounded-[100%] mix-blend-screen"></div>
      </div>
      
      <div className="text-center mb-8 sm:mb-16 relative z-10 w-full">
        <h1 className="text-5xl sm:text-7xl lg:text-[10rem] font-bold text-transparent bg-clip-text bg-gradient-to-b from-[#ffffff] to-[#a0aab8] select-none pb-2 leading-none" style={{ textShadow: '0 0 60px rgba(255,255,255,0.15)' }}>
          DPP Forge
        </h1>
        <p className="text-[#8b8fa3] text-sm sm:text-lg md:text-xl font-medium mt-3 max-w-sm sm:max-w-none mx-auto leading-relaxed">
          TDS to JSON · Digital Product Passport · QR Generator
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 sm:gap-6 relative z-10 w-full max-w-4xl">
        <button 
          onClick={() => setView('manual')}
          className="flex-1 group bg-[#1a1d27]/40 backdrop-blur-md border border-[#2e3245] hover:border-white/40 rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 text-left transition-all duration-500 hover:bg-[#1a1d27]/80"
        >
          <div className="bg-[#242736] w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-xl border border-[#2e3245]">
            <FileText className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-2xl font-semibold text-white mb-3">Manual Entry</h3>
          <p className="text-[#8b8fa3] leading-relaxed text-sm md:text-base">Enter TDS data manually using our structured form. Review outputs and generate a compliant DPP.</p>
        </button>

        <button 
          onClick={() => setView('upload')}
          className="flex-1 group bg-[#1a1d27]/40 backdrop-blur-md border border-[#2e3245] hover:border-white/40 rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 text-left transition-all duration-500 hover:bg-[#1a1d27]/80"
        >
          <div className="bg-[#242736] w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-xl border border-[#2e3245]">
            <Upload className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-2xl font-semibold text-white mb-3">Upload PDF</h3>
          <p className="text-[#8b8fa3] leading-relaxed text-sm md:text-base">AI extracts fields automatically from your uploaded Technical Data Sheet. Review and save.</p>
        </button>
      </div>
    </div>
  );
}
