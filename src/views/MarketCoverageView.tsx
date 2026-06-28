import { useEffect, useState } from 'react';
import { api } from '../api';
import { MarketCoverage, TargetMarketCoverage } from '../types';
import { Globe, ChevronDown, ChevronRight } from 'lucide-react';

export function MarketCoverageView() {
  const [data, setData] = useState<MarketCoverage | null>(null);
  const [targets, setTargets] = useState<TargetMarketCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    api.getMarketCoverage()
      .then(coverage => {
        if (mounted) setData(coverage);
      })
      .catch(e => {
        if (mounted) setError(e.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    api.getTargetMarketCoverage()
      .then(targetCoverage => {
        if (mounted) setTargets(targetCoverage);
      })
      .catch(() => {
        if (mounted) setTargets(null);
      });

    return () => { mounted = false; };
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-[#8b8fa3]">Loading market coverage...</div>;
  if (error) return <div className="p-6 text-red-400">{error}</div>;
  if (!data) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-5 px-4 py-6 sm:space-y-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Globe className="w-6 h-6 text-blue-400" />
        <h1 className="text-2xl font-bold text-white">Market Coverage</h1>
        <span className="w-full text-sm text-[#8b8fa3] sm:ml-2 sm:w-auto">{data.total_categories} categories</span>
      </div>

      {targets && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[#8b8fa3] uppercase tracking-wider">Target Market Map</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {targets.targets.map(target => (
              <div key={target.category} className="bg-[#1a1d27] border border-[#2e3245] rounded-xl p-4">
                <div className="flex flex-col items-start gap-2 mb-3 sm:flex-row sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <h3 className="text-white font-semibold">{target.category}</h3>
                    <p className="text-xs text-[#8b8fa3] mt-1">{target.covered_products} product(s), {target.covered_manufacturers} manufacturer(s) covered</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${target.coverage_status === 'covered' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {target.coverage_status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {target.key_products.map(product => (
                    <span key={product} className="text-xs bg-[#242736] text-[#c0c4d6] px-2 py-1 rounded">{product}</span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {target.required_standards.map(std => (
                    <span key={std} className="text-xs border border-[#2e3245] text-[#8b8fa3] px-2 py-1 rounded">{std}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.categories.length === 0 ? (
        <div className="text-center py-16 text-[#63677a]">
          <Globe className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg mb-1">No market data yet</p>
          <p className="text-sm">Create passports to build market coverage insights.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.categories.map(cat => {
            const isExpanded = expanded === cat.category;
            return (
              <div key={cat.category} className="bg-[#1a1d27] border border-[#2e3245] rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : cat.category)}
                  className="w-full p-4 flex items-start gap-3 hover:bg-[#1e2130] transition-colors sm:items-center sm:gap-4"
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-[#8b8fa3]" /> : <ChevronRight className="w-4 h-4 text-[#8b8fa3]" />}
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-white font-semibold">{cat.category}</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-[#8b8fa3] sm:gap-x-4">
                      <span>{cat.product_count} product{cat.product_count !== 1 ? 's' : ''}</span>
                      <span>{cat.manufacturer_count} manufacturer{cat.manufacturer_count !== 1 ? 's' : ''}</span>
                      <span>Avg confidence: {cat.avg_confidence}%</span>
                    </div>
                  </div>
                  <div className="hidden items-center gap-3 sm:flex">
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">{cat.product_count}</div>
                      <div className="text-xs text-[#63677a]">products</div>
                    </div>
                    <div className="w-16 bg-[#0f1117] rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min(cat.avg_confidence, 100)}%` }}
                      />
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-[#2e3245] p-4 space-y-3">
                    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                      <Stat label="Products" value={cat.product_count} />
                      <Stat label="Manufacturers" value={cat.manufacturer_count} />
                      <Stat label="Avg Confidence" value={`${cat.avg_confidence}%`} />
                      <Stat label="Standards Refs" value={cat.total_standards_refs} />
                    </div>

                    {cat.key_standards.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-[#8b8fa3] uppercase mb-2">Key Standards</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {cat.key_standards.map(std => (
                            <span key={std} className="text-xs bg-[#242736] text-[#c0c4d6] px-2 py-1 rounded">
                              {std}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#0f1117] rounded-lg p-3">
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-xs text-[#63677a]">{label}</div>
    </div>
  );
}
