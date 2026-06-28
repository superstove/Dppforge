import { useState, useEffect } from 'react';
import { Bell, Webhook, Globe, Clock, Plus, Trash2, Zap, CheckCircle, XCircle, AlertTriangle, Loader2, Send, Languages } from 'lucide-react';
import { api } from '../api';
import type { WebhookConfig, NotificationLogEntry, ExpiryAlert, ExpiryDashboard, TranslatedPassport } from '../types';

type Tab = 'webhooks' | 'expiry' | 'language';

const URGENCY_STYLES = {
  critical: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', label: 'Expired' },
  urgent: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', label: 'Urgent' },
  warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', label: 'Warning' },
  ok: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', label: 'OK' },
};

const CHANNEL_LABELS: Record<string, { label: string; color: string }> = {
  webhook: { label: 'Webhook', color: 'text-blue-400' },
  slack: { label: 'Slack', color: 'text-purple-400' },
  email: { label: 'Email', color: 'text-emerald-400' },
};

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'fil', name: 'Filipino', flag: '🇵🇭' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
];

export function NotificationsView() {
  const [tab, setTab] = useState<Tab>('webhooks');

  // Webhook state
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [logs, setLogs] = useState<NotificationLogEntry[]>([]);
  const [events, setEvents] = useState<{ id: string; label: string; description: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', url: '', channel: 'webhook', events: ['passport.created'] });
  const [testResult, setTestResult] = useState<{ id: number; status: string } | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  // Expiry state
  const [expiryDash, setExpiryDash] = useState<ExpiryDashboard | null>(null);
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlert[]>([]);

  // Language state
  const [passports, setPassports] = useState<{ id: number; product_name: string; manufacturer: string }[]>([]);
  const [selectedPassport, setSelectedPassport] = useState<number | null>(null);
  const [selectedLang, setSelectedLang] = useState('en');
  const [translated, setTranslated] = useState<TranslatedPassport | null>(null);
  const [translating, setTranslating] = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [wh, ev, dash, alerts, pp] = await Promise.all([
        api.getWebhooks(),
        api.getNotificationEvents(),
        api.getExpiryDashboard(),
        api.getExpiryAlerts(90),
        api.getPassports(100, 0),
      ]);
      setWebhooks(wh.items);
      setEvents(ev.events);
      setExpiryDash(dash);
      setExpiryAlerts(alerts.alerts);
      setPassports(pp.items.map(p => ({ id: p.id, product_name: p.product_name, manufacturer: p.manufacturer })));
    } catch { /* ignore */ }
    setLoading(false);
  };

  const createWebhook = async () => {
    if (!formData.url) return;
    await api.createWebhook(formData);
    setShowForm(false);
    setFormData({ name: '', url: '', channel: 'webhook', events: ['passport.created'] });
    const wh = await api.getWebhooks();
    setWebhooks(wh.items);
  };

  const deleteWebhook = async (id: number) => {
    await api.deleteWebhook(id);
    setWebhooks(prev => prev.filter(w => w.id !== id));
  };

  const testWebhook = async (id: number) => {
    setTestResult(null);
    const res = await api.testWebhook(id);
    setTestResult({ id, status: res.status });
    setTimeout(() => setTestResult(null), 3000);
    const lg = await api.getNotificationLogs();
    setLogs(lg.items);
  };

  const toggleEvent = (eventId: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter(e => e !== eventId)
        : [...prev.events, eventId],
    }));
  };

  const toggleActive = async (hook: WebhookConfig) => {
    await api.updateWebhook(hook.id, { active: !hook.active });
    setWebhooks(prev => prev.map(w => w.id === hook.id ? { ...w, active: !w.active } : w));
  };

  const loadLogs = async () => {
    setShowLogs(!showLogs);
    if (!showLogs) {
      const lg = await api.getNotificationLogs();
      setLogs(lg.items);
    }
  };

  const translatePassport = async () => {
    if (!selectedPassport) return;
    setTranslating(true);
    try {
      const result = await api.translatePassport(selectedPassport, selectedLang);
      setTranslated(result);
    } catch { /* ignore */ }
    setTranslating(false);
  };

  const tabs = [
    { id: 'webhooks' as Tab, label: 'Webhooks & Notifications', icon: Webhook },
    { id: 'expiry' as Tab, label: 'Expiry & Recertification', icon: Clock },
    { id: 'language' as Tab, label: 'Multi-language DPP', icon: Languages },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:p-8">
      <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">Notifications & Alerts</h1>
      <p className="text-[#8b8fa3] mb-6 text-base sm:text-lg">Webhook integrations, certificate expiry tracking, and multi-language passport generation.</p>

      <div className="flex flex-wrap gap-2 mb-8">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${tab === t.id ? 'bg-white text-black' : 'bg-[#1a1d27] text-[#8b8fa3] border border-[#2e3245] hover:text-white hover:border-[#4e5269]'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#8b8fa3]" /></div>
      )}

      {/* ─── WEBHOOKS TAB ─── */}
      {!loading && tab === 'webhooks' && (
        <>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white">Active Webhooks</h2>
            <div className="flex gap-2">
              <button onClick={loadLogs} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${showLogs ? 'bg-white text-black' : 'bg-[#1a1d27] border border-[#2e3245] text-[#8b8fa3] hover:text-white'}`}>
                <Bell className="w-4 h-4" /> Logs
              </button>
              <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors">
                <Plus className="w-4 h-4" /> Add Webhook
              </button>
            </div>
          </div>

          {/* Create form */}
          {showForm && (
            <div className="bg-[#1a1d27] border border-[#2e3245] rounded-2xl p-6 mb-6">
              <h3 className="text-white font-bold mb-4">New Webhook / Slack Integration</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-[#63677a] uppercase tracking-wider mb-1 block">Name</label>
                  <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="My Slack Webhook" className="w-full bg-[#0a0b10] border border-[#2e3245] text-white rounded-xl px-4 py-2.5 text-sm focus:border-white/50 outline-none" />
                </div>
                <div>
                  <label className="text-xs text-[#63677a] uppercase tracking-wider mb-1 block">Channel Type</label>
                  <select value={formData.channel} onChange={e => setFormData({ ...formData, channel: e.target.value })} className="w-full bg-[#0a0b10] border border-[#2e3245] text-white rounded-xl px-4 py-2.5 text-sm focus:border-white/50 outline-none">
                    <option value="webhook">Generic Webhook (POST)</option>
                    <option value="slack">Slack Incoming Webhook</option>
                    <option value="email">Email (via webhook relay)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-[#63677a] uppercase tracking-wider mb-1 block">
                    {formData.channel === 'slack' ? 'Slack Webhook URL' : 'Endpoint URL'}
                  </label>
                  <input value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} placeholder={formData.channel === 'slack' ? 'https://hooks.slack.com/services/T.../B.../...' : 'https://your-server.com/webhook'} className="w-full bg-[#0a0b10] border border-[#2e3245] text-white rounded-xl px-4 py-2.5 text-sm focus:border-white/50 outline-none font-mono" />
                </div>
              </div>

              <div className="mt-4">
                <label className="text-xs text-[#63677a] uppercase tracking-wider mb-2 block">Events to subscribe</label>
                <div className="flex flex-wrap gap-2">
                  {events.map(ev => (
                    <button key={ev.id} onClick={() => toggleEvent(ev.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${formData.events.includes(ev.id) ? 'bg-white text-black' : 'bg-[#0a0b10] border border-[#2e3245] text-[#8b8fa3] hover:text-white'}`} title={ev.description}>
                      {ev.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button onClick={createWebhook} disabled={!formData.url} className="px-6 py-2.5 bg-white text-black font-bold rounded-xl text-sm hover:bg-gray-200 transition-colors disabled:opacity-40">Create</button>
                <button onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-[#0a0b10] border border-[#2e3245] text-[#8b8fa3] rounded-xl text-sm hover:text-white transition-colors">Cancel</button>
              </div>
            </div>
          )}

          {/* Webhook list */}
          {webhooks.length === 0 ? (
            <div className="text-center py-16 text-[#8b8fa3]">
              <Webhook className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">No webhooks configured</p>
              <p className="text-sm mt-1">Add a Slack webhook or API endpoint to receive notifications when passports are created, manufacturers change stage, or certificates expire.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map(hook => {
                const ch = CHANNEL_LABELS[hook.channel] || CHANNEL_LABELS.webhook;
                return (
                  <div key={hook.id} className={`bg-[#1a1d27] border border-[#2e3245] rounded-xl px-5 py-4 ${!hook.active ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${hook.active ? 'bg-emerald-400' : 'bg-[#63677a]'}`}></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium text-sm">{hook.name}</p>
                          <span className={`text-xs font-medium ${ch.color}`}>{ch.label}</span>
                        </div>
                        <p className="text-xs text-[#63677a] font-mono truncate mt-0.5">{hook.url}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {hook.events.map(ev => (
                            <span key={ev} className="text-xs px-2 py-0.5 rounded-md bg-[#0a0b10] border border-[#2e3245] text-[#8b8fa3]">{ev}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {testResult?.id === hook.id && (
                          <span className={`text-xs font-medium ${testResult.status === 'sent' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {testResult.status === 'sent' ? 'Sent!' : 'Failed'}
                          </span>
                        )}
                        <span className="text-xs text-[#63677a]">{hook.trigger_count} sent</span>
                        <button onClick={() => testWebhook(hook.id)} className="p-2 rounded-lg hover:bg-white/10 text-[#8b8fa3] hover:text-white transition-colors" title="Test"><Send className="w-4 h-4" /></button>
                        <button onClick={() => toggleActive(hook)} className="p-2 rounded-lg hover:bg-white/10 text-[#8b8fa3] hover:text-white transition-colors" title={hook.active ? 'Disable' : 'Enable'}>
                          {hook.active ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4" />}
                        </button>
                        <button onClick={() => deleteWebhook(hook.id)} className="p-2 rounded-lg hover:bg-red-500/20 text-[#8b8fa3] hover:text-red-400 transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Notification Logs */}
          {showLogs && (
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-[#63677a] uppercase tracking-wider mb-4">Recent Notification Logs</h3>
              {logs.length === 0 ? (
                <p className="text-[#8b8fa3] text-sm">No logs yet. Create a webhook and test it to see delivery logs here.</p>
              ) : (
                <div className="space-y-2">
                  {logs.map(log => (
                    <div key={log.id} className="bg-[#0a0b10] border border-[#2e3245] rounded-xl px-4 py-3 flex items-center gap-3">
                      {log.status === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">{log.event}</p>
                        <p className="text-xs text-[#63677a] truncate">{log.payload_preview.slice(0, 100)}</p>
                      </div>
                      <span className="text-xs text-[#63677a]">{log.channel}</span>
                      <span className={`text-xs font-medium ${log.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>{log.response_code || '—'}</span>
                      <span className="text-xs text-[#63677a]">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Supported events reference */}
          <div className="mt-8 bg-[#1a1d27] border border-[#2e3245] rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-[#63677a] uppercase tracking-wider mb-4 flex items-center gap-2"><Zap className="w-4 h-4" /> Supported Events</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {events.map(ev => (
                <div key={ev.id} className="bg-[#0a0b10] border border-[#2e3245] rounded-xl px-4 py-3">
                  <p className="text-white text-sm font-medium">{ev.label}</p>
                  <p className="text-xs text-[#63677a] mt-0.5">{ev.description}</p>
                  <p className="text-xs font-mono text-[#4e5269] mt-1">{ev.id}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ─── EXPIRY & RECERTIFICATION TAB ─── */}
      {!loading && tab === 'expiry' && (
        <>
          {expiryDash && (
            <>
              {/* Headline */}
              <div className={`rounded-2xl p-6 mb-6 ${expiryDash.total_alerts > 0 ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
                <div className="flex items-center gap-3">
                  {expiryDash.total_alerts > 0 ? <AlertTriangle className="w-6 h-6 text-amber-400" /> : <CheckCircle className="w-6 h-6 text-emerald-400" />}
                  <div>
                    <p className="text-xl font-bold text-white">{expiryDash.headline}</p>
                    <p className="text-sm text-[#8b8fa3] mt-1">{expiryDash.total_alerts} certificate alert{expiryDash.total_alerts !== 1 ? 's' : ''} found across all passports</p>
                  </div>
                </div>
              </div>

              {/* Timeline sections */}
              {([
                { key: 'overdue' as const, label: 'Overdue / Expired', color: 'red', icon: XCircle },
                { key: 'this_week' as const, label: 'Expiring This Week', color: 'red', icon: AlertTriangle },
                { key: 'this_month' as const, label: 'Expiring This Month', color: 'amber', icon: Clock },
                { key: 'next_3_months' as const, label: 'Next 3 Months', color: 'blue', icon: Clock },
              ] as const).map(section => {
                const items = expiryDash.timeline[section.key];
                if (!items || items.length === 0) return null;
                return (
                  <div key={section.key} className="mb-6">
                    <h3 className={`text-sm font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 text-${section.color}-400`}>
                      <section.icon className="w-4 h-4" /> {section.label} ({items.length})
                    </h3>
                    <div className="space-y-2">
                      {items.map((item, idx) => (
                        <div key={idx} className={`bg-${section.color}-500/5 border border-${section.color}-500/15 rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3`}>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium text-sm">{item.product_name}</p>
                            <p className="text-xs text-[#63677a]">{item.certificate} · {item.passport_id}</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className={`text-sm font-bold ${item.days_until < 0 ? 'text-red-400' : item.days_until <= 7 ? 'text-red-400' : 'text-amber-400'}`}>
                                {item.days_until < 0 ? `${Math.abs(item.days_until)}d overdue` : `${item.days_until}d left`}
                              </p>
                              <p className="text-xs text-[#63677a]">{item.expiry_date}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {expiryDash.total_alerts === 0 && (
                <div className="text-center py-16 text-[#8b8fa3]">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-30 text-emerald-400" />
                  <p className="text-lg font-medium text-emerald-400">All certificates up to date</p>
                  <p className="text-sm mt-1">No expiring or expired certificates found in any passport.</p>
                </div>
              )}
            </>
          )}

          {/* Detailed alerts list */}
          {expiryAlerts.length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-semibold text-[#63677a] uppercase tracking-wider mb-4">All Alerts (90 days)</h3>
              <div className="space-y-2">
                {expiryAlerts.map((alert, idx) => {
                  const style = URGENCY_STYLES[alert.urgency] || URGENCY_STYLES.warning;
                  return (
                    <div key={idx} className={`${style.bg} border ${style.border} rounded-xl px-5 py-4`}>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium text-sm">{alert.product_name}</p>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text} border ${style.border}`}>{style.label}</span>
                          </div>
                          <p className="text-xs text-[#63677a] mt-1">{alert.certificate} · {alert.manufacturer}</p>
                          <p className="text-xs text-[#8b8fa3] mt-1.5">{alert.recommendation}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-lg font-bold ${style.text}`}>
                            {alert.days_until_expiry < 0 ? `${Math.abs(alert.days_until_expiry)}d` : `${alert.days_until_expiry}d`}
                          </p>
                          <p className="text-xs text-[#63677a]">{alert.days_until_expiry < 0 ? 'overdue' : 'remaining'}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── MULTI-LANGUAGE TAB ─── */}
      {!loading && tab === 'language' && (
        <>
          <div className="bg-[#1a1d27] border border-[#2e3245] rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Globe className="w-5 h-5" /> Generate Multi-language DPP</h3>
            <p className="text-sm text-[#8b8fa3] mb-6">Generate Digital Product Passports in 6 languages for EMEA coverage. Field labels and structure are translated per EU ESPR requirements.</p>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs text-[#63677a] uppercase tracking-wider mb-1 block">Passport</label>
                <select value={selectedPassport ?? ''} onChange={e => { setSelectedPassport(Number(e.target.value)); setTranslated(null); }} className="w-full bg-[#0a0b10] border border-[#2e3245] text-white rounded-xl px-4 py-2.5 text-sm focus:border-white/50 outline-none">
                  <option value="">Select passport...</option>
                  {passports.map(p => (
                    <option key={p.id} value={p.id}>{p.product_name} — {p.manufacturer}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#63677a] uppercase tracking-wider mb-1 block">Language</label>
                <select value={selectedLang} onChange={e => { setSelectedLang(e.target.value); setTranslated(null); }} className="w-full bg-[#0a0b10] border border-[#2e3245] text-white rounded-xl px-4 py-2.5 text-sm focus:border-white/50 outline-none">
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={translatePassport} disabled={!selectedPassport || translating} className="w-full bg-white text-black font-bold py-2.5 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-40 text-sm">
                  {translating ? 'Translating...' : 'Generate'}
                </button>
              </div>
            </div>
          </div>

          {/* Language grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {LANGUAGES.map(l => (
              <button key={l.code} onClick={() => { setSelectedLang(l.code); setTranslated(null); }} className={`rounded-xl p-4 text-center transition-all ${selectedLang === l.code ? 'bg-white text-black' : 'bg-[#1a1d27] border border-[#2e3245] text-[#8b8fa3] hover:text-white hover:border-[#4e5269]'}`}>
                <p className="text-2xl mb-1">{l.flag}</p>
                <p className="text-sm font-medium">{l.name}</p>
                <p className="text-xs opacity-60">{l.code.toUpperCase()}</p>
              </button>
            ))}
          </div>

          {/* Translation result */}
          {translated && (
            <div className="bg-[#1a1d27] border border-[#2e3245] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {translated.language.name} Translation
                  </h3>
                  <p className="text-sm text-[#8b8fa3]">Direction: {translated.language.direction.toUpperCase()}</p>
                </div>
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(translated.passport, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `dpp-${translated.language.code}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-4 py-2 bg-white text-black rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
                >
                  Download JSON
                </button>
              </div>

              {/* Field label mapping */}
              {Object.keys(translated.field_labels).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-[#63677a] uppercase tracking-wider mb-3">Field Label Translations</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(translated.field_labels).map(([en, local]) => (
                      <div key={en} className="bg-[#0a0b10] border border-[#2e3245] rounded-lg px-3 py-2">
                        <p className="text-xs text-[#63677a]">{en}</p>
                        <p className="text-sm text-white" dir={translated.language.direction}>{local as string}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-[#0a0b10] border border-[#2e3245] rounded-xl p-5 overflow-auto max-h-[400px] custom-scrollbar">
                <pre className="text-xs font-mono text-[#e4e6ed] whitespace-pre-wrap leading-relaxed" dir={translated.language.direction}>
                  {JSON.stringify(translated.passport, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
