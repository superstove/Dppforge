import { useEffect, useState } from 'react';
import { api } from '../api';
import { useRole } from '../RoleContext';
import { ManufacturerSummary, ManufacturerDetail, CRMActivity } from '../types';
import { Plus, ChevronRight, Mail, Phone, Globe, X, ArrowRight, MessageSquare, ClipboardList, CheckCircle } from 'lucide-react';

const STAGES = ['target', 'engaged', 'onboarded', 'active'] as const;
const STAGE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  target: { bg: 'bg-gray-500/10', text: 'text-gray-400', dot: 'bg-gray-500' },
  engaged: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-500' },
  onboarded: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', dot: 'bg-yellow-500' },
  active: { bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-500' },
};

export function ManufacturersView() {
  const [manufacturers, setManufacturers] = useState<ManufacturerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<ManufacturerDetail | null>(null);
  const [stageFilter, setStageFilter] = useState<string>('');
  const [pipelineCounts, setPipelineCounts] = useState<Record<string, number>>({});

  const load = () => {
    setLoading(true);
    Promise.all([
      api.getManufacturers(stageFilter || undefined),
      api.getPipelineSummary(),
    ]).then(([data, pipeline]) => {
      setManufacturers(data.items);
      setPipelineCounts(pipeline.stages);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [stageFilter]);

  const handleStageChange = async (mfr: ManufacturerSummary, newStage: string) => {
    await api.updateManufacturer(mfr.id, { crm_stage: newStage } as Partial<ManufacturerSummary>);
    load();
    if (selected && selected.id === mfr.id) {
      const detail = await api.getManufacturer(mfr.id);
      setSelected(detail);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5 px-4 py-6 sm:space-y-6 sm:p-8">
      <div className="flex flex-col items-stretch gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
        <h1 className="text-2xl font-bold text-white">Manufacturer CRM</h1>
        <button onClick={() => setShowAdd(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-black rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors">
          <Plus className="w-4 h-4" /> Add Manufacturer
        </button>
      </div>

      {/* Pipeline overview */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STAGES.map(stage => {
          const s = STAGE_STYLES[stage];
          const count = pipelineCounts[stage] || 0;
          const isActive = stageFilter === stage;
          return (
            <button
              key={stage}
              onClick={() => setStageFilter(isActive ? '' : stage)}
              className={`rounded-xl border p-4 text-left transition-all ${isActive ? 'border-white/30 bg-[#242736]' : 'border-[#2e3245] bg-[#1a1d27] hover:border-[#3e4255]'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${s.text}`}>{stage}</span>
              </div>
              <div className="text-2xl font-bold text-white">{count}</div>
            </button>
          );
        })}
      </div>

      {/* Manufacturer list */}
      {loading ? (
        <div className="text-[#8b8fa3] text-center py-12">Loading...</div>
      ) : manufacturers.length === 0 ? (
        <div className="text-center py-12 text-[#63677a]">
          <p className="text-lg mb-2">No manufacturers{stageFilter ? ` in "${stageFilter}" stage` : ''}</p>
          <p className="text-sm">Add your first manufacturer to start the pipeline.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {manufacturers.map(mfr => {
            const s = STAGE_STYLES[mfr.crm_stage] || STAGE_STYLES.target;
            return (
              <div
                key={mfr.id}
                onClick={() => api.getManufacturer(mfr.id).then(setSelected)}
              className="bg-[#1a1d27] border border-[#2e3245] rounded-xl p-4 cursor-pointer hover:border-[#3e4255] transition-all flex items-start gap-3 sm:items-center sm:gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1 sm:gap-3">
                    <span className="font-semibold text-white truncate">{mfr.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text}`}>{mfr.crm_stage}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8b8fa3]">
                    {mfr.country && <span>{mfr.country}</span>}
                    {mfr.categories && <span>{mfr.categories}</span>}
                    {mfr.contact_email && <span className="flex min-w-0 items-center gap-1 break-all"><Mail className="h-3 w-3 shrink-0" />{mfr.contact_email}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Stage advance button */}
                  {mfr.crm_stage !== 'active' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const idx = STAGES.indexOf(mfr.crm_stage as typeof STAGES[number]);
                        if (idx < STAGES.length - 1) handleStageChange(mfr, STAGES[idx + 1]);
                      }}
                      className="p-1.5 rounded-lg text-[#8b8fa3] hover:text-white hover:bg-[#242736] transition-colors"
                      title={`Advance to ${STAGES[STAGES.indexOf(mfr.crm_stage as typeof STAGES[number]) + 1]}`}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                  <ChevronRight className="w-4 h-4 text-[#63677a]" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Panel */}
      {selected && (
        <DetailPanel
          detail={selected}
          onClose={() => setSelected(null)}
          onRefresh={() => api.getManufacturer(selected.id).then(setSelected)}
        />
      )}

      {/* Add Modal */}
      {showAdd && <AddManufacturerModal onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function DetailPanel({ detail, onClose, onRefresh }: { detail: ManufacturerDetail; onClose: () => void; onRefresh: () => void }) {
  const { canApprove } = useRole();
  const [activityType, setActivityType] = useState('note');
  const [activityDesc, setActivityDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [claimForm, setClaimForm] = useState({ claimant_name: detail.contact_person || '', claimant_email: detail.contact_email || '', role: '', rights_basis: '', requested_scope: detail.categories || '' });
  const [requestForm, setRequestForm] = useState({ requested_documents: 'TDS, EPD, DoP', product_scope: detail.categories || '', message: 'Please upload current product evidence.', due_date: '' });
  const [uploadForm, setUploadForm] = useState({ document_type: 'TDS', title: '', file_name: '', product_scope: detail.categories || '', rights_status: 'manufacturer_authorized' });
  const [outreach, setOutreach] = useState<{ email_subject: string; email_body: string; phone_script: string; video_agenda: string[] } | null>(null);

  const addActivity = async () => {
    if (!activityDesc.trim()) return;
    setSubmitting(true);
    await api.addManufacturerActivity(detail.id, activityType, activityDesc);
    setActivityDesc('');
    setSubmitting(false);
    onRefresh();
  };

  const submitClaim = async () => {
    if (!claimForm.claimant_email.trim() && !claimForm.claimant_name.trim()) return;
    setSubmitting(true);
    await api.submitManufacturerClaim(detail.id, claimForm);
    setSubmitting(false);
    onRefresh();
  };

  const approveLatestClaim = async () => {
    const latest = detail.claims?.[0];
    if (!latest) return;
    setSubmitting(true);
    await api.reviewManufacturerClaim(latest.id, { status: 'approved', reviewer: 'DPP Ops', review_notes: 'Approved from CRM review.', authority_scope: latest.requested_scope || detail.categories });
    setSubmitting(false);
    onRefresh();
  };

  const requestRevision = async () => {
    const latest = detail.claims?.[0];
    if (!latest) return;
    setSubmitting(true);
    await api.reviewManufacturerClaim(latest.id, { status: 'revision_requested', reviewer: 'DPP Ops', review_notes: 'More evidence required.' });
    setSubmitting(false);
    onRefresh();
  };

  const createRequest = async () => {
    setSubmitting(true);
    await api.createDocumentRequest(detail.id, {
      requested_documents: requestForm.requested_documents.split(',').map(item => item.trim()).filter(Boolean),
      product_scope: requestForm.product_scope,
      message: requestForm.message,
      due_date: requestForm.due_date,
    });
    setSubmitting(false);
    onRefresh();
  };

  const createUpload = async () => {
    setSubmitting(true);
    await api.createManufacturerUpload(detail.id, uploadForm);
    setSubmitting(false);
    onRefresh();
  };

  const loadOutreach = async () => {
    setOutreach(await api.getOutreachTemplate(detail.id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative h-full w-full overflow-y-auto bg-[#0f1117] sm:max-w-lg sm:border-l sm:border-[#2e3245]">
        <div className="sticky top-0 bg-[#0f1117] border-b border-[#2e3245] p-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-white">{detail.name}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[#242736] text-[#8b8fa3]"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 space-y-5">
          {/* Contact info */}
          <div className="space-y-2 text-sm text-[#c0c4d6]">
            {detail.contact_person && <div className="flex items-center gap-2"><span className="text-[#8b8fa3]">Contact:</span>{detail.contact_person}</div>}
            {detail.contact_email && <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#8b8fa3]" />{detail.contact_email}</div>}
            {detail.contact_phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#8b8fa3]" />{detail.contact_phone}</div>}
            {detail.website && <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-[#8b8fa3]" />{detail.website}</div>}
            {detail.country && <div><span className="text-[#8b8fa3]">Country:</span> {detail.country}</div>}
            {detail.categories && <div><span className="text-[#8b8fa3]">Categories:</span> {detail.categories}</div>}
          {detail.notes && <div className="text-xs text-[#63677a] italic">{detail.notes}</div>}
          </div>

          <div className="bg-[#1a1d27] border border-[#2e3245] rounded-xl p-4">
            <h3 className="text-xs font-semibold text-[#8b8fa3] uppercase tracking-wider mb-3">Document Requests & Uploads</h3>
            <div className="grid grid-cols-1 gap-2 mb-3 sm:grid-cols-2">
              <input value={requestForm.requested_documents} onChange={e => setRequestForm({ ...requestForm, requested_documents: e.target.value })} placeholder="TDS, EPD, DoP" className="bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-xs text-white" />
              <input value={requestForm.product_scope} onChange={e => setRequestForm({ ...requestForm, product_scope: e.target.value })} placeholder="Product scope" className="bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-xs text-white" />
              <input value={requestForm.due_date} onChange={e => setRequestForm({ ...requestForm, due_date: e.target.value })} placeholder="Due date" className="bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-xs text-white" />
              <button onClick={createRequest} disabled={submitting} className="py-2 rounded-lg bg-[#242736] text-white text-xs font-medium disabled:opacity-40">Create Request</button>
            </div>
            <div className="grid grid-cols-1 gap-2 mb-3 sm:grid-cols-2">
              <input value={uploadForm.document_type} onChange={e => setUploadForm({ ...uploadForm, document_type: e.target.value })} placeholder="Document type" className="bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-xs text-white" />
              <input value={uploadForm.file_name} onChange={e => setUploadForm({ ...uploadForm, file_name: e.target.value })} placeholder="File name" className="bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-xs text-white" />
              <input value={uploadForm.title} onChange={e => setUploadForm({ ...uploadForm, title: e.target.value })} placeholder="Title" className="bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-xs text-white" />
              <button onClick={createUpload} disabled={submitting} className="py-2 rounded-lg bg-white text-black text-xs font-medium disabled:opacity-40">Record Upload</button>
            </div>
            {(detail.document_requests || []).length > 0 && (
              <div className="space-y-2 mb-3">
                <p className="text-[10px] text-[#63677a] uppercase font-semibold tracking-wider">Active Requests</p>
                {(detail.document_requests || []).map(request => {
                  const statusColor = request.status === 'fulfilled' ? 'border-green-500/30' : request.missing_documents?.length ? 'border-amber-500/30' : 'border-[#2e3245]';
                  return (
                    <div key={request.id} className={`rounded-lg bg-[#0f1117] border ${statusColor} p-3 text-xs`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white font-medium">{request.product_scope || 'Portfolio request'}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${request.status === 'fulfilled' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          {request.status || 'open'}
                        </span>
                      </div>
                      {request.due_date && <div className="text-[#8b8fa3]">Due: {request.due_date}</div>}
                      {request.missing_documents?.length > 0 && (
                        <div className="text-amber-300/80 mt-1">Missing: {request.missing_documents.join(', ')}</div>
                      )}
                      {request.missing_documents?.length === 0 && (
                        <div className="text-green-400/80 mt-1">All documents received</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {(detail.uploads || []).length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] text-[#63677a] uppercase font-semibold tracking-wider">Received Uploads</p>
                {(detail.uploads || []).map(upload => {
                  const reviewColor = upload.review_status === 'approved' ? 'text-green-400' : upload.review_status === 'rejected' ? 'text-red-400' : 'text-yellow-400';
                  return (
                    <div key={upload.id} className="rounded-lg bg-[#0f1117] border border-[#2e3245] p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">{upload.document_type}: {upload.title || upload.file_name}</span>
                        <span className={`text-[10px] font-semibold uppercase ${reviewColor}`}>{upload.review_status}</span>
                      </div>
                      {upload.product_scope && <div className="text-[#8b8fa3] mt-0.5">Scope: {upload.product_scope}</div>}
                      <div className="text-[#63677a] mt-0.5">Rights: {upload.rights_status}</div>
                    </div>
                  );
                })}
              </div>
            )}
            {(detail.document_requests || []).length === 0 && (detail.uploads || []).length === 0 && (
              <p className="text-xs text-[#63677a]">No document requests or uploads yet.</p>
            )}
          </div>

          {/* Claim profile */}
          <div className="bg-[#1a1d27] border border-[#2e3245] rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-xs font-semibold text-[#8b8fa3] uppercase tracking-wider flex items-center gap-2">
                <ClipboardList className="w-4 h-4" /> Claim Profile
              </h3>
              <span className={`text-xs px-2 py-1 rounded-full ${detail.claim_profile?.status === 'approved' ? 'bg-green-500/10 text-green-400' : detail.claim_profile?.status === 'submitted' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-[#242736] text-[#8b8fa3]'}`}>
                {detail.claim_profile?.status || 'unclaimed'}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 mb-3 sm:grid-cols-2">
              <input value={claimForm.claimant_name} onChange={e => setClaimForm({ ...claimForm, claimant_name: e.target.value })} placeholder="Claimant name" className="bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-xs text-white placeholder-[#63677a]" />
              <input value={claimForm.claimant_email} onChange={e => setClaimForm({ ...claimForm, claimant_email: e.target.value })} placeholder="Claimant email" className="bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-xs text-white placeholder-[#63677a]" />
              <input value={claimForm.role} onChange={e => setClaimForm({ ...claimForm, role: e.target.value })} placeholder="Role" className="bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-xs text-white placeholder-[#63677a]" />
              <input value={claimForm.requested_scope} onChange={e => setClaimForm({ ...claimForm, requested_scope: e.target.value })} placeholder="Scope" className="bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-xs text-white placeholder-[#63677a]" />
            </div>
            <input value={claimForm.rights_basis} onChange={e => setClaimForm({ ...claimForm, rights_basis: e.target.value })} placeholder="Rights basis, e.g. authorized manufacturer data steward" className="w-full bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-xs text-white placeholder-[#63677a] mb-3" />
            <div className="flex flex-col gap-2 sm:flex-row">
              <button onClick={submitClaim} disabled={submitting} className="flex-1 py-2 rounded-lg bg-white text-black text-xs font-medium disabled:opacity-40">Submit Claim</button>
              <button onClick={requestRevision} disabled={submitting || !detail.claims?.length} className="px-3 py-2 rounded-lg bg-yellow-500/10 text-yellow-400 text-xs font-medium disabled:opacity-40">Revision</button>
              {canApprove ? (
                <button onClick={approveLatestClaim} disabled={submitting || !detail.claims?.length} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium disabled:opacity-40">
                  <CheckCircle className="w-3.5 h-3.5" /> Approve
                </button>
              ) : (
                <span className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#1a1d27] text-[#63677a] text-xs" title="Switch to Reviewer or Admin role to approve claims">
                  <CheckCircle className="w-3.5 h-3.5" /> Approve (Reviewer only)
                </span>
              )}
            </div>
          </div>

          {/* Outreach template */}
          <div className="bg-[#1a1d27] border border-[#2e3245] rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-xs font-semibold text-[#8b8fa3] uppercase tracking-wider">Outreach</h3>
              <button onClick={loadOutreach} className="text-xs px-3 py-1.5 rounded-lg bg-[#242736] text-[#c0c4d6] hover:text-white">Generate Template</button>
            </div>
            {outreach ? (
              <div className="space-y-3 text-xs">
                <div>
                  <p className="text-[#63677a] mb-1">Subject</p>
                  <p className="text-white">{outreach.email_subject}</p>
                </div>
                <textarea readOnly value={outreach.email_body} className="w-full min-h-32 bg-[#0f1117] border border-[#2e3245] rounded-lg p-3 text-[#c0c4d6] resize-none" />
                <p className="text-[#8b8fa3]">{outreach.phone_script}</p>
              </div>
            ) : (
              <p className="text-xs text-[#63677a]">Create email, phone, and video talking points for manufacturer cooperation.</p>
            )}
          </div>

          {/* Passports */}
          {detail.passports.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[#8b8fa3] uppercase tracking-wider mb-2">Linked Passports ({detail.passports.length})</h3>
              <div className="space-y-1">
                {detail.passports.map(p => (
                  <div key={p.id} className="text-sm text-[#c0c4d6] bg-[#1a1d27] rounded-lg px-3 py-2 flex justify-between">
                    <span className="truncate">{p.product_name}</span>
                    <span className="text-xs text-[#63677a] uppercase">{p.document_type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add activity */}
          <div>
            <h3 className="text-xs font-semibold text-[#8b8fa3] uppercase tracking-wider mb-2">Add Activity</h3>
            <div className="flex flex-wrap gap-2 mb-2">
              {['note', 'email', 'call', 'meeting'].map(t => (
                <button
                  key={t}
                  onClick={() => setActivityType(t)}
                  className={`text-xs px-3 py-1 rounded-full capitalize transition-colors ${activityType === t ? 'bg-white text-black' : 'bg-[#242736] text-[#8b8fa3] hover:text-white'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={activityDesc}
                onChange={e => setActivityDesc(e.target.value)}
                placeholder="Describe the activity..."
                className="flex-1 bg-[#1a1d27] border border-[#2e3245] rounded-lg px-3 py-2 text-sm text-white placeholder-[#63677a] focus:outline-none focus:border-[#4e5269]"
                onKeyDown={e => e.key === 'Enter' && addActivity()}
              />
              <button onClick={addActivity} disabled={submitting || !activityDesc.trim()} className="px-3 py-2 bg-white text-black rounded-lg text-sm font-medium disabled:opacity-40">
                Add
              </button>
            </div>
          </div>

          {/* Activity timeline */}
          {detail.activities.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[#8b8fa3] uppercase tracking-wider mb-2">Activity Timeline</h3>
              <div className="space-y-2">
                {detail.activities.map(a => (
                  <div key={a.id} className="flex items-start gap-3 text-sm">
                    <div className="mt-1">
                      <MessageSquare className="w-3.5 h-3.5 text-[#63677a]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[#8b8fa3] uppercase">{a.activity_type}</span>
                        <span className="text-xs text-[#63677a]">{new Date(a.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-[#c0c4d6] mt-0.5">{a.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddManufacturerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', country: '', website: '', contact_email: '', contact_phone: '', contact_person: '', categories: '', notes: '', crm_stage: 'target' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    try {
      await api.createManufacturer(form as unknown as Partial<ManufacturerSummary>);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  };

  const fields: { key: keyof typeof form; label: string; placeholder: string }[] = [
    { key: 'name', label: 'Company Name *', placeholder: 'e.g. BASF, Sika, Mapei' },
    { key: 'country', label: 'Country', placeholder: 'e.g. Germany' },
    { key: 'contact_person', label: 'Contact Person', placeholder: 'Full name' },
    { key: 'contact_email', label: 'Email', placeholder: 'contact@company.com' },
    { key: 'contact_phone', label: 'Phone', placeholder: '+49...' },
    { key: 'website', label: 'Website', placeholder: 'https://...' },
    { key: 'categories', label: 'Product Categories', placeholder: 'Adhesives, Sealants, Mortars' },
    { key: 'notes', label: 'Notes', placeholder: 'Internal notes...' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[92svh] w-full overflow-y-auto rounded-t-2xl border border-[#2e3245] bg-[#1a1d27] p-4 sm:max-w-md sm:rounded-2xl sm:p-6">
        <h2 className="text-lg font-bold text-white mb-4">Add Manufacturer</h2>
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <div className="space-y-3">
          {fields.map(f => (
            <div key={f.key}>
              <label className="text-xs text-[#8b8fa3] mb-1 block">{f.label}</label>
              <input
                value={form[f.key]}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className="w-full bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-sm text-white placeholder-[#63677a] focus:outline-none focus:border-[#4e5269]"
              />
            </div>
          ))}
          <div>
            <label className="text-xs text-[#8b8fa3] mb-1 block">Initial Stage</label>
            <select
              value={form.crm_stage}
              onChange={e => setForm({ ...form, crm_stage: e.target.value })}
              className="w-full bg-[#0f1117] border border-[#2e3245] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            >
              {STAGES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm text-[#8b8fa3] border border-[#2e3245] hover:bg-[#242736]">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-gray-200 disabled:opacity-40">
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
