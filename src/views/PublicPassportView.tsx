import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, FileJson, HardHat, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { api, resolveAssetUrl } from '../api';
import type { PassportDetail, TechnicalProperty } from '../types';

export function PublicPassportView({ passportId }: { passportId: string }) {
  const [data, setData] = useState<PassportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.getPassport(passportId)
      .then((result) => {
        if (mounted) setData(result);
      })
      .catch((err: unknown) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Passport could not be verified.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [passportId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0b10] text-white flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-[#8b8fa3] font-semibold">
          <Loader2 className="w-6 h-6 animate-spin" />
          Verifying passport...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0b10] text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-[#1a1d27] border border-[#ef4444]/30 rounded-2xl p-8 text-center">
          <XCircle className="w-14 h-14 text-[#ef4444] mx-auto mb-5" />
          <h1 className="text-2xl font-bold mb-3">Passport Not Found</h1>
          <p className="text-[#8b8fa3]">{error || 'The QR code does not match a saved DPP record.'}</p>
        </div>
      </div>
    );
  }

  const dpp = data.dpp_json || {};
  const technicalProperties = Object.entries(dpp.technical_properties || {});

  return (
    <div className="min-h-screen bg-[#0a0b10] text-[#e4e6ed] p-4 sm:p-8">
      <main className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-2">
          <a href="/" className="inline-flex items-center gap-3 text-white font-bold tracking-wider">
            <span className="w-9 h-9 bg-white text-black rounded-sm flex items-center justify-center">
              <HardHat className="w-5 h-5" />
            </span>
            DPP FORGE
          </a>
          <a href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#8b8fa3] hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Open converter
          </a>
        </header>

        <section className="bg-[#1a1d27] border border-[#2e3245] rounded-2xl p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#22c55e]/30 bg-[#22c55e]/10 px-3 py-1 text-sm font-bold text-[#22c55e] mb-5">
                <ShieldCheck className="w-4 h-4" />
                Verified DPP Record
              </div>
              <h1 className="text-3xl sm:text-5xl font-bold text-white tracking-tight mb-3">{data.product_name}</h1>
              <p className="text-[#8b8fa3] text-lg">{data.manufacturer || 'Unknown manufacturer'}</p>
            </div>
            {data.qr_code_url && (
              <div className="bg-white p-3 rounded-2xl self-start">
                <img src={resolveAssetUrl(data.qr_code_url)} alt="DPP QR code" className="w-32 h-32" />
              </div>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Info label="Passport ID" value={data.passport_id} />
          <Info label="Category" value={data.category || 'N/A'} />
          <Info label="Batch" value={data.batch_number || 'N/A'} />
        </section>

        <section className="bg-[#1a1d27] border border-[#2e3245] rounded-2xl p-6 sm:p-8">
          <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-[#22c55e]" />
            Standards Compliance
          </h2>
          <div className="flex flex-wrap gap-2">
            {(dpp.standards_compliance || []).length ? (
              dpp.standards_compliance.map((standard: string, index: number) => (
                <span key={index} className="bg-[#242736] border border-[#2e3245] rounded-full px-4 py-2 text-sm font-semibold text-white">
                  {standard}
                </span>
              ))
            ) : (
              <p className="text-[#8b8fa3]">No standards listed.</p>
            )}
          </div>
        </section>

        <section className="bg-[#1a1d27] border border-[#2e3245] rounded-2xl p-6 sm:p-8">
          <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
            <FileJson className="w-5 h-5" />
            Technical Properties
          </h2>
          {technicalProperties.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {technicalProperties.map(([key, prop]: [string, TechnicalProperty]) => (
                <div key={key} className="bg-[#242736] border border-[#2e3245] rounded-xl p-4">
                  <p className="text-xs uppercase text-[#8b8fa3] font-bold mb-2">{key.replace(/_/g, ' ')}</p>
                  <p className="text-white font-mono text-lg">
                    {prop.value} <span className="text-sm text-[#8b8fa3]">{prop.unit}</span>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[#8b8fa3]">No technical properties listed.</p>
          )}
        </section>

        <footer className="border border-[#2e3245] rounded-2xl p-5 text-center text-sm text-[#8b8fa3]">
          Powered by <span className="text-white font-bold">DPP Forge</span> · TDS to Digital Product Passport conversion
        </footer>
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#1a1d27] border border-[#2e3245] rounded-2xl p-5">
      <p className="text-xs uppercase font-bold text-[#8b8fa3] mb-2">{label}</p>
      <p className="text-white font-semibold break-words">{value}</p>
    </div>
  );
}
