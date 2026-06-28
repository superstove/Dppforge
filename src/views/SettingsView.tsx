import { CheckCircle, Database, Globe2, QrCode } from 'lucide-react';
import { API_BASE } from '../api';

export function SettingsView() {
  const settings = [
    { label: 'API target', value: API_BASE, icon: Globe2 },
    { label: 'Database', value: 'Supabase/PostgreSQL when DATABASE_URL is set', icon: Database },
    { label: 'DPP QR', value: 'Opens the public DPP Forge passport page', icon: QrCode },
    { label: 'ConstructAsk QR', value: 'Opens ConstructAsk with the DPP reference', icon: CheckCircle },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-32 sm:p-8 sm:pb-32">
      <div className="mb-8 sm:mb-10">
        <h2 className="text-3xl font-bold text-white tracking-tight mb-2 sm:text-4xl">Settings</h2>
        <p className="text-[#8b8fa3] font-medium">Deployment and integration status for DPP Forge.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {settings.map((item) => (
          <section key={item.label} className="bg-[#1a1d27]/80 border border-[#2e3245] rounded-2xl p-4 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 shrink-0 rounded-xl bg-[#242736] border border-[#2e3245] flex items-center justify-center text-white">
                <item.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-white font-bold mb-1">{item.label}</h3>
                <p className="text-[#8b8fa3] text-sm leading-relaxed break-words">{item.value}</p>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
