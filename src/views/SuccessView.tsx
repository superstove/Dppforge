import { CheckCircle, Database } from 'lucide-react';
import { resolveAssetUrl } from '../api';
import type { SaveResult } from '../types';

export function SuccessView({ setView, data }: { setView: (v: string) => void; data: SaveResult }) {
  const dppQrUrl = resolveAssetUrl(data.dpp_qr_code_url || data.qr_code_url);
  const constructAskQrUrl = resolveAssetUrl(data.constructask_qr_code_url);

  const downloadImage = async (url: string, filename: string) => {
    const res = await fetch(url);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
  };

  return (
    <div className="min-h-[calc(100svh-4rem)] flex flex-col items-center justify-center px-4 py-6 sm:p-8 relative overflow-hidden bg-black">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[300px] bg-[#22c55e]/10 blur-[100px] rounded-full mix-blend-screen"></div>
      </div>

      <div className="bg-[#1a1d27]/60 backdrop-blur-xl border border-[#2e3245] rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-12 max-w-3xl w-full text-center relative z-10 shadow-2xl">
        <div className="mx-auto w-16 h-16 sm:w-24 sm:h-24 bg-[#22c55e]/10 text-[#22c55e] rounded-full flex items-center justify-center mb-6 sm:mb-8 border border-[#22c55e]/20 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
          <CheckCircle className="w-9 h-9 sm:w-12 sm:h-12" />
        </div>
        
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight">DPP Saved!</h2>
        <p className="text-[#8b8fa3] text-base sm:text-lg mb-8 sm:mb-10 leading-relaxed">Digital Product Passport successfully generated and securely stored in the registry.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
          <div className="bg-[#0f1117] rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-[#2e3245] shadow-inner">
            <div className="bg-white p-4 rounded-2xl inline-block mb-5 shadow-lg">
              <img src={dppQrUrl} alt="DPP Forge QR Code" className="w-40 h-40" />
            </div>
            <p className="text-sm font-bold text-white mb-2 uppercase tracking-wider">DPP Forge QR</p>
            <p className="text-xs text-[#8b8fa3] mb-4">Stick this on the product to open the public DPP passport.</p>
            <button
              onClick={() => downloadImage(dppQrUrl, `${data.passport_id || 'dpp'}-dpp-forge-qr.png`)}
              className="w-full bg-[#242736] hover:bg-[#2e3245] text-white py-3 rounded-full font-bold transition-colors border border-[#2e3245]"
            >
              Download
            </button>
          </div>
          <div className="bg-[#0f1117] rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-[#2e3245] shadow-inner">
            <div className="bg-white p-4 rounded-2xl inline-block mb-5 shadow-lg">
              <img src={constructAskQrUrl} alt="ConstructAsk QR Code" className="w-40 h-40" />
            </div>
            <p className="text-sm font-bold text-white mb-2 uppercase tracking-wider">ConstructAsk QR</p>
            <p className="text-xs text-[#8b8fa3] mb-4">Use this when the passport should open in ConstructAsk.</p>
            <button
              onClick={() => downloadImage(constructAskQrUrl, `${data.passport_id || 'dpp'}-constructask-qr.png`)}
              className="w-full bg-[#242736] hover:bg-[#2e3245] text-white py-3 rounded-full font-bold transition-colors border border-[#2e3245]"
            >
              Download
            </button>
          </div>
        </div>

        <div className="space-y-4 mb-8 sm:mb-10 text-left bg-[#242736]/50 p-5 sm:p-6 rounded-2xl border border-[#2e3245]">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b border-[#2e3245] pb-3">
            <span className="text-[#8b8fa3] text-sm font-medium">Passport ID</span>
            <span className="text-white font-mono text-xs sm:text-sm bg-[#1a1d27] px-3 py-1 rounded-md break-all">{data.passport_id || 'N/A'}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 pt-1">
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
