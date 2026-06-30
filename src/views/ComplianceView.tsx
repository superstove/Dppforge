import { useState, useEffect } from 'react';
import { Shield, ShieldCheck, ShieldAlert, ShieldX, ChevronDown, ChevronUp, Leaf, QrCode, Send, Eye, Calculator, Loader2 } from 'lucide-react';
import { api } from '../api';
import type { ComplianceOverview, ComplianceResult, GS1Identifier, CarbonResult, PassportCarbon, ComplianceRulebook } from '../types';

const GRADE_STYLES = {
  green: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'Compliant' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', label: 'Partial' },
  red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', label: 'Non-Compliant' },
};

const STATUS_ICON = {
  pass: { color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  warning: { color: 'text-amber-400', bg: 'bg-amber-500/10' },
  missing: { color: 'text-red-400', bg: 'bg-red-500/10' },
};

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  public: { label: 'Public', color: 'text-emerald-400' },
  authorized: { label: 'Authorized', color: 'text-blue-400' },
  authority: { label: 'Authority', color: 'text-purple-400' },
};

type Tab = 'overview' | 'detail' | 'carbon' | 'gs1' | 'registry';

export function ComplianceView() {
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<ComplianceOverview | null>(null);
  const [detail, setDetail] = useState<ComplianceResult | null>(null);
  const [gs1, setGs1] = useState<GS1Identifier | null>(null);
  const [carbonResult, setCarbonResult] = useState<CarbonResult | null>(null);
  const [passportCarbon, setPassportCarbon] = useState<PassportCarbon | null>(null);
  const [registryData, setRegistryData] = useState<Record<string, unknown> | null>(null);
  const [rulebook, setRulebook] = useState<ComplianceRulebook | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expandedField, setExpandedField] = useState<string | null>(null);

  // Carbon calculator form
  const [carbonForm, setCarbonForm] = useState({ material: 'cement', weight_kg: '1000', transport_mode: 'road', transport_km: '200', recycled_content_pct: '0' });

  useEffect(() => { loadOverview(); }, []);

  const loadOverview = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [data, rules] = await Promise.all([api.complianceOverview(), api.complianceRulebook()]);
      let resolvedOverview = data;

      if (data.total === 0) {
        resolvedOverview = await buildOverviewFromSavedPassports();
      }

      setOverview(resolvedOverview);
      setRulebook(rules);
    } catch (err) {
      try {
        setOverview(await buildOverviewFromSavedPassports());
        setRulebook(await api.complianceRulebook().catch(() => null));
      } catch {
        setOverview(null);
        setLoadError(err instanceof Error ? err.message : 'Could not load compliance data.');
      }
    }
    setLoading(false);
  };

  const buildOverviewFromSavedPassports = async (): Promise<ComplianceOverview> => {
    const saved = await api.getPassports(100, 0);
    if (saved.total === 0) {
      return { total: 0, green: 0, amber: 0, red: 0, avg_score: 0, items: [] };
    }

    const checked = await Promise.all(saved.items.map(async passport => {
      try {
        const result = await api.checkCompliance(passport.id);
        return {
          id: passport.id,
          passport_id: passport.passport_id,
          product_name: result.product_name || passport.product_name,
          manufacturer: passport.manufacturer,
          category: result.category || passport.category,
          compliance_score: result.compliance_score,
          grade: result.grade,
        };
      } catch {
        return {
          id: passport.id,
          passport_id: passport.passport_id,
          product_name: passport.product_name,
          manufacturer: passport.manufacturer,
          category: passport.category,
          compliance_score: 0,
          grade: 'red' as const,
        };
      }
    }));

    const green = checked.filter(item => item.grade === 'green').length;
    const amber = checked.filter(item => item.grade === 'amber').length;
    const red = checked.filter(item => item.grade === 'red').length;
    const avg_score = Math.round(checked.reduce((sum, item) => sum + item.compliance_score, 0) / checked.length);

    return {
      total: checked.length,
      green,
      amber,
      red,
      avg_score,
      items: checked.sort((a, b) => a.compliance_score - b.compliance_score),
    };
  };

  const loadDetail = async (id: number) => {
    setSelectedId(id);
    setTab('detail');
    setDetail(null);
    try {
      const [comp, carbon] = await Promise.all([
        api.checkCompliance(id),
        api.passportCarbon(id),
      ]);
      setDetail(comp);
      setPassportCarbon(carbon);
    } catch { /* ignore */ }
  };

  const loadGS1 = async (id: number) => {
    setSelectedId(id);
    setTab('gs1');
    setGs1(null);
    try { setGs1(await api.getGS1(id)); } catch { /* ignore */ }
  };

  const loadRegistry = async (id: number) => {
    setSelectedId(id);
    setTab('registry');
    setRegistryData(null);
    try { setRegistryData(await api.registryExport(id)); } catch { /* ignore */ }
  };

  const calculateCarbon = async () => {
    try {
      const res = await api.carbonCalculator({
        material: carbonForm.material,
        weight_kg: parseFloat(carbonForm.weight_kg) || 0,
        transport_mode: carbonForm.transport_mode,
        transport_km: parseFloat(carbonForm.transport_km) || 0,
        recycled_content_pct: parseFloat(carbonForm.recycled_content_pct) || 0,
      });
      setCarbonResult(res);
    } catch { /* ignore */ }
  };

  const tabs = [
    { id: 'overview' as Tab, label: 'ESPR Overview', icon: Shield },
    { id: 'detail' as Tab, label: 'Passport Check', icon: ShieldCheck },
    { id: 'carbon' as Tab, label: 'GWP Calculator', icon: Leaf },
    { id: 'gs1' as Tab, label: 'GS1 Identifiers', icon: QrCode },
    { id: 'registry' as Tab, label: 'EU Registry', icon: Send },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:p-8">
      <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">EU Compliance</h1>
      <p className="text-[#8b8fa3] mb-6 text-base sm:text-lg">ESPR compliance engine, GS1 identifiers, carbon calculator, 3-tier access, and EU DPP Registry export.</p>

      {rulebook && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-amber-300 font-semibold text-sm">Rulebook status: {rulebook.validation_status.replace(/_/g, ' ')}</p>
              <p className="text-amber-200/80 text-xs mt-1">{rulebook.disclaimer}</p>
            </div>
            <span className="text-xs text-amber-300">{rulebook.rules.length} mapped rule(s)</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${tab === t.id ? 'bg-white text-black' : 'bg-[#1a1d27] text-[#8b8fa3] border border-[#2e3245] hover:text-white hover:border-[#4e5269]'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ─── ESPR OVERVIEW ─── */}
      {tab === 'overview' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#8b8fa3]" /></div>
          ) : loadError ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-red-200">
              <p className="font-semibold">Compliance data could not be loaded</p>
              <p className="text-sm mt-1 text-red-200/80">{loadError}</p>
              <button onClick={loadOverview} className="mt-4 bg-white text-black px-5 py-2 rounded-full text-sm font-bold hover:bg-gray-200 transition-colors">Retry</button>
            </div>
          ) : overview && overview.total > 0 ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="bg-[#1a1d27] border border-[#2e3245] rounded-2xl p-5 text-center">
                  <p className="text-3xl font-bold text-white">{overview.avg_score}%</p>
                  <p className="text-sm text-[#8b8fa3] mt-1">Avg Compliance</p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 text-center">
                  <p className="text-3xl font-bold text-emerald-400">{overview.green}</p>
                  <p className="text-sm text-emerald-400/70 mt-1">Compliant</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 text-center">
                  <p className="text-3xl font-bold text-amber-400">{overview.amber}</p>
                  <p className="text-sm text-amber-400/70 mt-1">Partial</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 text-center">
                  <p className="text-3xl font-bold text-red-400">{overview.red}</p>
                  <p className="text-sm text-red-400/70 mt-1">Non-Compliant</p>
                </div>
              </div>

              {/* Compliance bar visual */}
              <div className="bg-[#1a1d27] border border-[#2e3245] rounded-2xl p-6 mb-8">
                <h3 className="text-sm font-semibold text-[#63677a] uppercase tracking-wider mb-4">Compliance Distribution</h3>
                <div className="w-full h-6 rounded-full overflow-hidden flex bg-[#0a0b10]">
                  {overview.green > 0 && <div className="bg-emerald-500 h-full transition-all" style={{ width: `${(overview.green / overview.total) * 100}%` }}></div>}
                  {overview.amber > 0 && <div className="bg-amber-500 h-full transition-all" style={{ width: `${(overview.amber / overview.total) * 100}%` }}></div>}
                  {overview.red > 0 && <div className="bg-red-500 h-full transition-all" style={{ width: `${(overview.red / overview.total) * 100}%` }}></div>}
                </div>
                <div className="flex justify-between mt-2 text-xs text-[#63677a]">
                  <span>0%</span>
                  <span>{overview.total} passports analyzed against ESPR + CPR</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Per-passport list */}
              <div className="space-y-2">
                {overview.items.map(item => {
                  const style = GRADE_STYLES[item.grade];
                  return (
                    <div key={item.id} className={`${style.bg} border ${style.border} rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 cursor-pointer hover:brightness-110 transition-all`} onClick={() => loadDetail(item.id)}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {item.grade === 'green' ? <ShieldCheck className={`w-5 h-5 ${style.text} flex-shrink-0`} /> : item.grade === 'amber' ? <ShieldAlert className={`w-5 h-5 ${style.text} flex-shrink-0`} /> : <ShieldX className={`w-5 h-5 ${style.text} flex-shrink-0`} />}
                        <div className="min-w-0">
                          <p className="text-white font-medium text-sm truncate">{item.product_name}</p>
                          <p className="text-xs text-[#63677a]">{item.manufacturer} · {item.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-lg font-bold ${style.text}`}>{item.compliance_score}%</span>
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${style.bg} ${style.text} border ${style.border}`}>{style.label}</span>
                        <div className="flex gap-1">
                          <button onClick={e => { e.stopPropagation(); loadGS1(item.id); }} className="p-1.5 rounded-lg hover:bg-white/10 text-[#8b8fa3] hover:text-white transition-colors" title="GS1 ID"><QrCode className="w-4 h-4" /></button>
                          <button onClick={e => { e.stopPropagation(); loadRegistry(item.id); }} className="p-1.5 rounded-lg hover:bg-white/10 text-[#8b8fa3] hover:text-white transition-colors" title="Registry Export"><Send className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-[#8b8fa3]">
              <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No passports to analyze</p>
              <p className="text-sm mt-1">Create passports first, then check their EU compliance here.</p>
            </div>
          )}
        </>
      )}

      {/* ─── PASSPORT DETAIL CHECK ─── */}
      {tab === 'detail' && (
        <>
          {!detail ? (
            <div className="text-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#8b8fa3] mx-auto mb-4" />
              <p className="text-[#8b8fa3]">Analyzing passport against ESPR mandatory fields...</p>
            </div>
          ) : (
            <>
              <button onClick={() => setTab('overview')} className="text-[#8b8fa3] hover:text-white text-sm mb-6 transition-colors">&larr; Back to overview</button>

              {/* Header */}
              <div className={`${GRADE_STYLES[detail.grade].bg} border ${GRADE_STYLES[detail.grade].border} rounded-2xl p-6 mb-6`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">{detail.product_name}</h2>
                    <p className="text-sm text-[#8b8fa3] mt-1">{detail.category} · {detail.passport_id}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {detail.applicable_regulations.map(r => (
                        <span key={r} className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/80">{r}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-center">
                    <p className={`text-5xl font-bold ${GRADE_STYLES[detail.grade].text}`}>{detail.compliance_score}%</p>
                    <p className={`text-sm font-medium ${GRADE_STYLES[detail.grade].text} mt-1`}>{GRADE_STYLES[detail.grade].label}</p>
                  </div>
                </div>

                {/* Summary bar */}
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-400">{detail.summary.pass}</p>
                    <p className="text-xs text-[#8b8fa3]">Pass</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-400">{detail.summary.warning}</p>
                    <p className="text-xs text-[#8b8fa3]">Warning</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-400">{detail.summary.missing}</p>
                    <p className="text-xs text-[#8b8fa3]">Missing</p>
                  </div>
                </div>
              </div>

              {/* Carbon info */}
              {passportCarbon && (
                <div className="bg-[#1a1d27] border border-[#2e3245] rounded-2xl p-6 mb-6">
                  <h3 className="text-sm font-semibold text-[#63677a] uppercase tracking-wider mb-4 flex items-center gap-2"><Leaf className="w-4 h-4" /> Carbon Footprint (GWP)</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-[#63677a]">Declared GWP</p>
                      <p className="text-lg font-bold text-white">{passportCarbon.declared_gwp ? `${passportCarbon.declared_gwp.value} ${passportCarbon.declared_gwp.unit}` : 'Not declared'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#63677a]">Industry Benchmark</p>
                      <p className="text-lg font-bold text-white">{passportCarbon.reference_gwp ? `${passportCarbon.reference_gwp.value} ${passportCarbon.reference_gwp.unit}` : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#63677a]">Rating</p>
                      <p className={`text-lg font-bold ${passportCarbon.gwp_rating === 'excellent' || passportCarbon.gwp_rating === 'good' ? 'text-emerald-400' : passportCarbon.gwp_rating === 'average' ? 'text-amber-400' : passportCarbon.gwp_rating === 'high' ? 'text-red-400' : 'text-[#8b8fa3]'}`}>{passportCarbon.gwp_rating ? passportCarbon.gwp_rating.charAt(0).toUpperCase() + passportCarbon.gwp_rating.slice(1) : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#63677a]">CPR Applicable</p>
                      <p className={`text-lg font-bold ${passportCarbon.cpr_applicable ? 'text-amber-400' : 'text-[#8b8fa3]'}`}>{passportCarbon.cpr_applicable ? `Yes (${passportCarbon.cpr_deadline})` : 'No'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 3-Tier Access Control legend */}
              <div className="bg-[#1a1d27] border border-[#2e3245] rounded-2xl p-6 mb-6">
                <h3 className="text-sm font-semibold text-[#63677a] uppercase tracking-wider mb-4 flex items-center gap-2"><Eye className="w-4 h-4" /> 3-Tier Access Control (EU ESPR)</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3 text-center">
                    <p className="text-emerald-400 font-semibold text-sm">Public</p>
                    <p className="text-xs text-[#63677a] mt-1">Consumers — basic product info via QR scan</p>
                  </div>
                  <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3 text-center">
                    <p className="text-blue-400 font-semibold text-sm">Authorized</p>
                    <p className="text-xs text-[#63677a] mt-1">Recyclers & repairers — materials, composition</p>
                  </div>
                  <div className="bg-purple-500/5 border border-purple-500/15 rounded-xl p-3 text-center">
                    <p className="text-purple-400 font-semibold text-sm">Authority</p>
                    <p className="text-xs text-[#63677a] mt-1">Regulators — full compliance data</p>
                  </div>
                </div>
              </div>

              {/* Field-by-field checks */}
              <div className="space-y-2">
                {detail.fields.map(field => {
                  const s = STATUS_ICON[field.status];
                  const tierStyle = TIER_LABELS[field.access_tier] || TIER_LABELS.public;
                  const isExpanded = expandedField === field.field;
                  return (
                    <div key={field.field} className={`${s.bg} border border-[#2e3245] rounded-xl overflow-hidden transition-all`}>
                      <button onClick={() => setExpandedField(isExpanded ? null : field.field)} className="w-full flex items-center gap-3 px-5 py-3.5 text-left">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${field.status === 'pass' ? 'bg-emerald-400' : field.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'}`}></span>
                        <span className="text-white font-medium text-sm flex-1">{field.label}</span>
                        <span className={`text-xs font-medium ${tierStyle.color}`}>{tierStyle.label}</span>
                        <span className={`text-xs font-medium uppercase px-2 py-0.5 rounded ${field.status === 'pass' ? 'text-emerald-400' : field.status === 'warning' ? 'text-amber-400' : 'text-red-400'}`}>{field.status}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-[#63677a]" /> : <ChevronDown className="w-4 h-4 text-[#63677a]" />}
                      </button>
                      {isExpanded && (
                        <div className="px-5 pb-4 border-t border-[#2e3245] pt-3">
                          <p className="text-sm text-[#8b8fa3]">{field.description}</p>
                          <p className="text-xs text-[#63677a] mt-2">Regulation: {field.regulation}</p>
                          {field.value && <p className="text-sm text-white mt-2 font-mono bg-[#0a0b10] px-3 py-1.5 rounded-lg">{field.value}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ─── GWP CARBON CALCULATOR ─── */}
      {tab === 'carbon' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-[#1a1d27] border border-[#2e3245] rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><Calculator className="w-5 h-5" /> GWP Carbon Calculator</h3>
            <p className="text-sm text-[#8b8fa3] mb-6">Calculate Global Warming Potential per EN 15804+A2. Mandatory for cement & steel from January 2026 (CPR).</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-[#63677a] uppercase tracking-wider mb-1 block">Material</label>
                <select value={carbonForm.material} onChange={e => setCarbonForm({ ...carbonForm, material: e.target.value })} className="w-full bg-[#0a0b10] border border-[#2e3245] text-white rounded-xl px-4 py-2.5 text-sm focus:border-white/50 outline-none">
                  {['cement', 'concrete', 'steel', 'rebar', 'aluminium', 'glass', 'brick', 'timber', 'plaster', 'insulation', 'pvc', 'bitumen', 'tile adhesive', 'mortar', 'geomembrane', 'grout'].map(m => (
                    <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#63677a] uppercase tracking-wider mb-1 block">Weight (kg)</label>
                <input type="number" value={carbonForm.weight_kg} onChange={e => setCarbonForm({ ...carbonForm, weight_kg: e.target.value })} className="w-full bg-[#0a0b10] border border-[#2e3245] text-white rounded-xl px-4 py-2.5 text-sm focus:border-white/50 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[#63677a] uppercase tracking-wider mb-1 block">Transport Mode</label>
                  <select value={carbonForm.transport_mode} onChange={e => setCarbonForm({ ...carbonForm, transport_mode: e.target.value })} className="w-full bg-[#0a0b10] border border-[#2e3245] text-white rounded-xl px-4 py-2.5 text-sm focus:border-white/50 outline-none">
                    <option value="road">Road</option><option value="rail">Rail</option><option value="sea">Sea</option><option value="air">Air</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#63677a] uppercase tracking-wider mb-1 block">Distance (km)</label>
                  <input type="number" value={carbonForm.transport_km} onChange={e => setCarbonForm({ ...carbonForm, transport_km: e.target.value })} className="w-full bg-[#0a0b10] border border-[#2e3245] text-white rounded-xl px-4 py-2.5 text-sm focus:border-white/50 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-[#63677a] uppercase tracking-wider mb-1 block">Recycled Content (%)</label>
                <input type="number" min="0" max="100" value={carbonForm.recycled_content_pct} onChange={e => setCarbonForm({ ...carbonForm, recycled_content_pct: e.target.value })} className="w-full bg-[#0a0b10] border border-[#2e3245] text-white rounded-xl px-4 py-2.5 text-sm focus:border-white/50 outline-none" />
              </div>
              <button onClick={calculateCarbon} className="w-full bg-white text-black font-bold py-3 rounded-full hover:bg-gray-200 transition-colors mt-2">Calculate GWP</button>
            </div>
          </div>

          <div className="bg-[#1a1d27] border border-[#2e3245] rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-6">Results</h3>
            {carbonResult ? (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-5 text-center">
                  <p className="text-4xl font-bold text-emerald-400">{carbonResult.total_gwp_kgCO2e}</p>
                  <p className="text-sm text-emerald-400/70 mt-1">{carbonResult.unit} total</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0a0b10] border border-[#2e3245] rounded-xl p-4">
                    <p className="text-xs text-[#63677a]">A1-A3 Production</p>
                    <p className="text-lg font-bold text-white">{carbonResult.lca_stages.A1_A3_production} kgCO2e</p>
                  </div>
                  <div className="bg-[#0a0b10] border border-[#2e3245] rounded-xl p-4">
                    <p className="text-xs text-[#63677a]">A4 Transport</p>
                    <p className="text-lg font-bold text-white">{carbonResult.lca_stages.A4_transport} kgCO2e</p>
                  </div>
                </div>

                <div className="bg-[#0a0b10] border border-[#2e3245] rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-[#63677a]">GWP Factor</span><span className="text-white">{carbonResult.gwp_factor} kgCO2e/kg</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#63677a]">Source</span><span className="text-white">{carbonResult.gwp_factor_source}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#63677a]">Recycled Reduction</span><span className="text-white">{(1 - carbonResult.recycled_reduction_factor) * 100 > 0 ? `-${((1 - carbonResult.recycled_reduction_factor) * 100).toFixed(1)}%` : 'None'}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#63677a]">Per Unit</span><span className="text-white">{carbonResult.gwp_per_unit} {carbonResult.gwp_per_unit_label}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#63677a]">Methodology</span><span className="text-white">{carbonResult.methodology}</span></div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 text-[#8b8fa3]">
                <Leaf className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Fill in the form and click "Calculate GWP" to see results.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── GS1 IDENTIFIER ─── */}
      {tab === 'gs1' && (
        <>
          {!gs1 ? (
            <>
              <p className="text-[#8b8fa3] mb-6">Select a passport from the overview to generate its GS1 Digital Link identifier.</p>
              <button onClick={() => setTab('overview')} className="bg-white text-black px-6 py-3 rounded-full font-bold hover:bg-gray-200 transition-colors">&larr; Go to Overview</button>
            </>
          ) : (
            <>
              <button onClick={() => setTab('overview')} className="text-[#8b8fa3] hover:text-white text-sm mb-6 transition-colors">&larr; Back to overview</button>

              <div className="bg-[#1a1d27] border border-[#2e3245] rounded-2xl p-6 mb-6">
                <h3 className="text-lg font-bold text-white mb-2">GS1 Digital Link — {gs1.product_name}</h3>
                <p className="text-sm text-[#8b8fa3] mb-6">EU ESPR mandates GS1 Digital Link URIs as the standard unique identifier for all Digital Product Passports.</p>

                <div className="bg-[#0a0b10] border border-[#2e3245] rounded-xl p-5 mb-6">
                  <p className="text-xs text-[#63677a] uppercase tracking-wider mb-2">Digital Link URI</p>
                  <p className="text-white font-mono text-sm break-all">{gs1.gs1.digital_link_uri}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="bg-[#0a0b10] border border-[#2e3245] rounded-xl p-4">
                    <p className="text-xs text-[#63677a]">GTIN-14</p>
                    <p className="text-white font-mono text-sm">{gs1.gs1.gtin}</p>
                  </div>
                  <div className="bg-[#0a0b10] border border-[#2e3245] rounded-xl p-4">
                    <p className="text-xs text-[#63677a]">Serial (AI-21)</p>
                    <p className="text-white font-mono text-sm">{gs1.gs1.serial_number}</p>
                  </div>
                  <div className="bg-[#0a0b10] border border-[#2e3245] rounded-xl p-4">
                    <p className="text-xs text-[#63677a]">Data Carrier</p>
                    <p className="text-white text-sm">{gs1.gs1.data_carrier}</p>
                  </div>
                </div>

                <div className="mt-6 bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
                  <p className="text-blue-300 text-xs"><strong>EU Regulation:</strong> All DPPs must use GS1 Digital Link URIs as unique identifiers. The data carrier (QR code) must encode this URI for scanning. This replaces proprietary ID schemes from July 2026.</p>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ─── EU DPP REGISTRY EXPORT ─── */}
      {tab === 'registry' && (
        <>
          {!registryData ? (
            <>
              <p className="text-[#8b8fa3] mb-6">Select a passport from the overview to generate its EU DPP Registry submission.</p>
              <button onClick={() => setTab('overview')} className="bg-white text-black px-6 py-3 rounded-full font-bold hover:bg-gray-200 transition-colors">&larr; Go to Overview</button>
            </>
          ) : (
            <>
              <button onClick={() => setTab('overview')} className="text-[#8b8fa3] hover:text-white text-sm mb-6 transition-colors">&larr; Back to overview</button>

              <div className="bg-[#1a1d27] border border-[#2e3245] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-white">EU DPP Registry Payload</h3>
                    <p className="text-sm text-[#8b8fa3] mt-1">Ready for submission when the EU DPP Registry goes live (July 2026)</p>
                  </div>
                  <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">Draft</span>
                </div>

                <div className="bg-[#0a0b10] border border-[#2e3245] rounded-xl p-5 overflow-auto max-h-[500px] custom-scrollbar">
                  <pre className="text-xs font-mono text-[#e4e6ed] whitespace-pre-wrap leading-relaxed">{JSON.stringify(registryData, null, 2)}</pre>
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(registryData, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `eu-registry-${(registryData as Record<string, unknown>)?.identifier ? 'export' : 'payload'}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="bg-white text-black px-6 py-2.5 rounded-full font-bold text-sm hover:bg-gray-200 transition-colors"
                  >
                    Download JSON
                  </button>
                </div>

                <div className="mt-4 bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
                  <p className="text-blue-300 text-xs"><strong>Note:</strong> The EU DPP Registry goes operational on 19 July 2026. This payload follows the expected schema based on ESPR Art. 12 and CEN/CENELEC harmonised standards. The format will be updated as official specifications are published.</p>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
