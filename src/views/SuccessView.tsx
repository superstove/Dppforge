import { CheckCircle, Database } from 'lucide-react';

export function SuccessView({ setView, data }: any) {
  const qrUrl = data.qr_code_url || '';

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-8 relative overflow-hidden bg-black">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[300px] bg-[#22c55e]/10 blur-[100px] rounded-full mix-blend-screen"></div>
      </div>

      <div className="bg-[#1a1d27]/60 backdrop-blur-xl border border-[#2e3245] rounded-[2.5rem] p-12 max-w-xl w-full text-center relative z-10 shadow-2xl">
        <div className="mx-auto w-24 h-24 bg-[#22c55e]/10 text-[#22c55e] rounded-full flex items-center justify-center mb-8 border border-[#22c55e]/20 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
          <CheckCircle className="w-12 h-12" />
        </div>
        
        <h2 className="text-4xl font-bold text-white mb-3 tracking-tight">DPP Saved!</h2>
        <p className="text-[#8b8fa3] text-lg mb-10">Digital Product Passport successfully generated and securely stored in the registry.</p>

        <div className="bg-[#0f1117] rounded-3xl p-8 border border-[#2e3245] mb-10 shadow-inner">
          <div className="bg-white p-4 rounded-2xl inline-block mb-6 shadow-lg">
            <img src={qrUrl} alt="QR Code" className="w-48 h-48" />
          </div>
          <p className="text-sm font-bold text-white mb-2 uppercase tracking-wider">Scan to verify in ConstructAsk</p>
          <a href={data.verification_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-[#6366f1] hover:text-white transition-colors break-all">
            {data.verification_url || "https://constructask.vercel.app/verify/..."}
          </a>
        </div>

        <div className="space-y-4 mb-10 text-left bg-[#242736]/50 p-6 rounded-2xl border border-[#2e3245]">
          <div className="flex justify-between items-center border-b border-[#2e3245] pb-3">
            <span className="text-[#8b8fa3] text-sm font-medium">Passport ID</span>
            <span className="text-white font-mono text-sm bg-[#1a1d27] px-3 py-1 rounded-md">{data.passport_id || 'N/A'}</span>
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-[#8b8fa3] text-sm font-medium">Product Name</span>
            <span className="text-white font-bold">{data.product_name || 'N/A'}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={() => setView('home')}
            className="flex-1 bg-[#242736] hover:bg-[#2e3245] text-white py-4 rounded-full font-bold transition-colors border border-[#2e3245]"
          >
            New Conversion
          </button>
          <button 
            onClick={() => setView('passports')}
            className="flex-1 flex justify-center items-center bg-white text-black py-4 rounded-full font-bold hover:bg-gray-200 transition-colors shadow-xl"
          >
            <Database className="w-5 h-5 mr-2" /> View Registry
          </button>
        </div>
      </div>
    </div>
  );
}
