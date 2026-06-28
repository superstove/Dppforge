import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { DashboardStats } from '../types';
import {
  FileCheck, Factory, Shield, TrendingUp, ArrowUpRight,
  BarChart3, Layers, Cpu, Clock, ChevronRight
} from 'lucide-react';

const STAGE_META: Record<string, { label: string; color: string; bg: string; ring: string }> = {
  target:    { label: 'Target',    color: 'text-slate-300',   bg: 'bg-slate-500',   ring: 'ring-slate-500/30' },
  engaged:   { label: 'Engaged',   color: 'text-blue-300',    bg: 'bg-blue-500',    ring: 'ring-blue-500/30' },
  onboarded: { label: 'Onboarded', color: 'text-amber-300',   bg: 'bg-amber-500',   ring: 'ring-amber-500/30' },
  active:    { label: 'Active',    color: 'text-emerald-300', bg: 'bg-emerald-500', ring: 'ring-emerald-500/30' },
};

const DOC_TYPE_COLORS: Record<string, string> = {
  tds: 'bg-blue-500',
  epd: 'bg-emerald-500',
  dop: 'bg-amber-500',
  test_report: 'bg-purple-500',
};

const METHOD_LABELS: Record<string, string> = {
  ai_gemini: 'Gemini AI',
  ai_openai: 'OpenAI',
  regex: 'Regex Fallback',
  manual: 'Manual Entry',
};

export function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getDashboard()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <span className="text-[#8b8fa3] text-sm">Loading dashboard...</span>
      </div>
    </div>
  );
  if (error) return <div className="p-8 text-red-400 text-center">{error}</div>;
  if (!stats) return null;

  const { overview } = stats;
  const totalPipeline: number = (Object.values(stats.crm_pipeline) as number[]).reduce((s, v) => s + Number(v), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-[#63677a] text-sm mt-1">Real-time overview of your DPP operations</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-[#63677a] bg-[#1a1d27] border border-[#2e3245] rounded-lg px-3 py-2">
          <Clock className="w-3.5 h-3.5" />
          Updated just now
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<FileCheck className="w-5 h-5" />}
          label="Total Passports"
          value={overview.total_passports}
          accent="blue"
          subtitle={overview.total_passports > 0 ? `${overview.high_confidence_pct}% high confidence` : undefined}
        />
        <KpiCard
          icon={<Factory className="w-5 h-5" />}
          label="Manufacturers"
          value={overview.total_manufacturers}
          accent="purple"
          subtitle={totalPipeline > 0 ? `${Number((stats.crm_pipeline as Record<string, number>)['active'] || 0)} active` : undefined}
        />
        <KpiCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="Avg Confidence"
          value={`${overview.avg_confidence}%`}
          accent="emerald"
          subtitle={overview.avg_confidence >= 80 ? 'Excellent' : overview.avg_confidence >= 60 ? 'Good' : overview.avg_confidence > 0 ? 'Needs review' : undefined}
        />
        <KpiCard
          icon={<Shield className="w-5 h-5" />}
          label="Verified"
          value={overview.verified_count}
          accent="amber"
          subtitle={overview.total_passports > 0 ? `of ${overview.total_passports} total` : undefined}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CRM Pipeline — spans 2 cols */}
        <Card title="CRM Pipeline" icon={<Factory className="w-4 h-4" />} className="lg:col-span-2">
          {totalPipeline === 0 ? (
            <EmptyState text="No manufacturers yet" />
          ) : (
            <div className="space-y-5">
              {/* Stage summary chips */}
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.crm_pipeline).map(([stage, rawVal]) => {
                  const count = Number(rawVal);
                  const meta = STAGE_META[stage] || STAGE_META.target;
                  return (
                    <div key={stage} className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0f1117] border border-[#2e3245] ring-1 ${meta.ring}`}>
                      <div className={`w-2.5 h-2.5 rounded-full ${meta.bg}`} />
                      <span className={`text-sm font-medium ${meta.color}`}>{meta.label}</span>
                      <span className="text-lg font-bold text-white ml-1">{count}</span>
                    </div>
                  );
                })}
              </div>
              {/* Progress bars */}
              <div className="space-y-3">
                {Object.entries(stats.crm_pipeline).map(([stage, rawVal2]) => {
                  const count = Number(rawVal2);
                  const pct = totalPipeline > 0 ? (count / totalPipeline) * 100 : 0;
                  const meta = STAGE_META[stage] || STAGE_META.target;
                  return (
                    <div key={stage}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium text-[#8b8fa3] capitalize">{meta.label}</span>
                        <span className="text-xs text-[#63677a]">{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-3 bg-[#0f1117] rounded-full overflow-hidden">
                        <div
                          className={`h-full ${meta.bg} rounded-full transition-all duration-700`}
                          style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* By Document Type — donut-like vertical */}
        <Card title="Document Types" icon={<Layers className="w-4 h-4" />}>
          {Object.keys(stats.by_document_type).length === 0 ? (
            <EmptyState text="No passports yet" />
          ) : (
            <div className="space-y-3">
              {Object.entries(stats.by_document_type).map(([type, rawC]) => {
                const count = Number(rawC);
                const total: number = (Object.values(stats.by_document_type) as number[]).reduce((s, v) => s + Number(v), 0);
                const pct = total > 0 ? (count / total) * 100 : 0;
                const barColor = DOC_TYPE_COLORS[type] || 'bg-gray-500';
                return (
                  <div key={type} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${barColor}`} />
                        <span className="text-sm font-medium text-[#c0c4d6] uppercase">{type.replace('_', ' ')}</span>
                      </div>
                      <span className="text-sm font-bold text-white">{count}</span>
                    </div>
                    <div className="h-2 bg-[#0f1117] rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor} rounded-full transition-all duration-700`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Conversion Methods */}
        <Card title="Conversion Methods" icon={<Cpu className="w-4 h-4" />}>
          {Object.keys(stats.by_conversion_method).length === 0 ? (
            <EmptyState text="No data" />
          ) : (
            <div className="space-y-2.5">
              {Object.entries(stats.by_conversion_method).map(([method, rawM]) => {
                const label = METHOD_LABELS[method] || method.replace('_', ' ');
                return (
                  <div key={method} className="flex items-center justify-between p-3 rounded-xl bg-[#0f1117] border border-[#2e3245]/50 hover:border-[#3e4255] transition-colors">
                    <span className="text-sm text-[#c0c4d6]">{label}</span>
                    <span className="text-lg font-bold text-white">{Number(rawM)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Top Categories — spans 2 cols */}
        <Card title="Top Categories" icon={<BarChart3 className="w-4 h-4" />} className="lg:col-span-2">
          {stats.by_category.length === 0 ? (
            <EmptyState text="No data" />
          ) : (
            <div className="grid sm:grid-cols-2 gap-2.5">
              {stats.by_category.slice(0, 8).map(({ category, count }, i) => (
                <div key={category} className="flex items-center gap-3 p-3 rounded-xl bg-[#0f1117] border border-[#2e3245]/50">
                  <div className="w-8 h-8 rounded-lg bg-[#242736] border border-[#2e3245] flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-[#8b8fa3]">{i + 1}</span>
                  </div>
                  <span className="text-sm text-[#c0c4d6] flex-1 truncate">{category}</span>
                  <span className="text-sm font-bold text-white">{count}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent Passports */}
      <Card title="Recent Passports" icon={<Clock className="w-4 h-4" />}>
        {stats.recent_passports.length === 0 ? (
          <EmptyState text="No passports created yet. Upload a document or use manual entry to create your first DPP." />
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-[#63677a] text-left border-b border-[#2e3245]">
                  <th className="pb-3 pl-5 font-medium text-xs uppercase tracking-wider">Product</th>
                  <th className="pb-3 font-medium text-xs uppercase tracking-wider">Manufacturer</th>
                  <th className="pb-3 font-medium text-xs uppercase tracking-wider">Type</th>
                  <th className="pb-3 font-medium text-xs uppercase tracking-wider">Confidence</th>
                  <th className="pb-3 pr-5 font-medium text-xs uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_passports.map(p => (
                  <tr key={p.id} className="border-b border-[#2e3245]/30 hover:bg-[#0f1117]/50 transition-colors">
                    <td className="py-3.5 pl-5">
                      <span className="text-white font-medium">{p.product_name}</span>
                    </td>
                    <td className="py-3.5 text-[#a0a8bf]">{p.manufacturer}</td>
                    <td className="py-3.5">
                      <DocTypeBadge type={p.document_type} />
                    </td>
                    <td className="py-3.5">
                      <ConfidenceBar score={p.confidence_score} />
                    </td>
                    <td className="py-3.5 pr-5 text-xs text-[#63677a]">
                      {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ─── Subcomponents ─── */

const ACCENT_STYLES = {
  blue:    { icon: 'bg-blue-500/15 text-blue-400 border-blue-500/20', glow: 'shadow-blue-500/5' },
  purple:  { icon: 'bg-purple-500/15 text-purple-400 border-purple-500/20', glow: 'shadow-purple-500/5' },
  emerald: { icon: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', glow: 'shadow-emerald-500/5' },
  amber:   { icon: 'bg-amber-500/15 text-amber-400 border-amber-500/20', glow: 'shadow-amber-500/5' },
};

function KpiCard({ icon, label, value, accent, subtitle }: {
  icon: ReactNode; label: string; value: string | number; accent: keyof typeof ACCENT_STYLES; subtitle?: string;
}) {
  const s = ACCENT_STYLES[accent];
  return (
    <div className={`bg-[#1a1d27] rounded-2xl border border-[#2e3245] p-5 hover:border-[#3e4255] transition-all shadow-lg ${s.glow}`}>
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${s.icon}`}>
        {icon}
      </div>
      <div className="text-3xl font-bold text-white tracking-tight">{value}</div>
      <div className="text-sm text-[#8b8fa3] mt-1">{label}</div>
      {subtitle && (
        <div className="text-xs text-[#63677a] mt-2 flex items-center gap-1">
          <ArrowUpRight className="w-3 h-3" />
          {subtitle}
        </div>
      )}
    </div>
  );
}

function Card({ title, icon, children, className = '' }: {
  title: string; icon: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <div className={`bg-[#1a1d27] rounded-2xl border border-[#2e3245] overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-5 pt-5 pb-4">
        <div className="text-[#63677a]">{icon}</div>
        <h2 className="text-sm font-semibold text-[#8b8fa3] uppercase tracking-wider">{title}</h2>
      </div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-8 text-[#63677a] text-sm text-center">
      {text}
    </div>
  );
}

function DocTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    tds: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
    epd: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    dop: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
    test_report: 'bg-purple-500/15 text-purple-300 border-purple-500/20',
  };
  const c = colors[type] || 'bg-[#242736] text-[#8b8fa3] border-[#2e3245]';
  return (
    <span className={`text-[11px] font-semibold uppercase px-2.5 py-1 rounded-lg border ${c}`}>
      {type.replace('_', ' ')}
    </span>
  );
}

export function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 90 ? 'text-green-400 bg-green-400/10' : score >= 70 ? 'text-yellow-400 bg-yellow-400/10' : score >= 50 ? 'text-orange-400 bg-orange-400/10' : 'text-red-400 bg-red-400/10';
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded ${color}`}>
      {score > 0 ? `${score}%` : '—'}
    </span>
  );
}

function ConfidenceBar({ score }: { score: number }) {
  const color = score >= 90 ? 'bg-emerald-500' : score >= 70 ? 'bg-amber-500' : score >= 50 ? 'bg-orange-500' : 'bg-red-500';
  const textColor = score >= 90 ? 'text-emerald-400' : score >= 70 ? 'text-amber-400' : score >= 50 ? 'text-orange-400' : 'text-red-400';

  if (score <= 0) return <span className="text-xs text-[#63677a]">—</span>;

  return (
    <div className="flex items-center gap-2.5 min-w-[120px]">
      <div className="flex-1 h-2 bg-[#0f1117] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-mono font-bold ${textColor}`}>{score}%</span>
    </div>
  );
}
