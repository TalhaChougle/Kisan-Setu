import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { disputes as disputesApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Alert from '../components/Alert';
import { PageSpinner } from '../components/Spinner';

export default function DisputeDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [form, setForm] = useState({ resolution: '', action: 'RELEASE_ESCROW' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    disputesApi.get(id)
      .then(({ data }) => setDispute(data.dispute))
      .catch(() => setError(t('common.error')))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleResolve(e) {
    e.preventDefault();
    setResolving(true);
    try {
      const { data } = await disputesApi.resolve(id, form);
      setSuccess(`Dispute resolved. ${data.escrow || ''}`);
      setDispute(d => ({ ...d, status: 'RESOLVED', resolution: form.resolution }));
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    } finally { setResolving(false); }
  }

  if (loading) return <PageSpinner />;
  if (!dispute) return <Alert type="error" message="Dispute not found." />;

  const deal = dispute.deal;

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800 mb-4 block">← Back</button>

      {error   && <Alert type="error"   message={error}   onClose={() => setError('')} />}
      {success && <Alert type="success" message={success} />}

      <div className="card mb-5">
        <div className="flex justify-between items-start mb-4">
          <h1>Dispute #{dispute.dispute_id.slice(-8)}</h1>
          <StatusBadge status={dispute.status} />
        </div>

        <div className="space-y-3 text-sm">
          <div><p className="text-gray-400 text-xs uppercase">Reason</p><p className="font-semibold">{dispute.reason}</p></div>
          {dispute.description && <div><p className="text-gray-400 text-xs uppercase">Description</p><p>{dispute.description}</p></div>}
          {dispute.evidence_url && (
            <div><p className="text-gray-400 text-xs uppercase">Evidence</p>
              <a href={dispute.evidence_url} className="text-brand-600 hover:underline" target="_blank" rel="noreferrer">{dispute.evidence_url}</a>
            </div>
          )}
          <div><p className="text-gray-400 text-xs uppercase">Raised by</p><p className="capitalize">{dispute.raised_by_type}</p></div>
          <div><p className="text-gray-400 text-xs uppercase">Raised on</p><p>{new Date(dispute.created_at).toLocaleString('en-IN')}</p></div>
          {dispute.resolution && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs text-gray-400 uppercase">Resolution</p>
              <p className="text-green-800 font-medium">{dispute.resolution}</p>
            </div>
          )}
        </div>
      </div>

      {/* Deal info */}
      {deal && (
        <div className="card mb-5">
          <h3 className="mb-3">Related Deal</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-gray-400 text-xs">Token</p><p className="font-mono font-bold">{deal.token}</p></div>
            <div><p className="text-gray-400 text-xs">Status</p><StatusBadge status={deal.status} /></div>
            <div><p className="text-gray-400 text-xs">Commodity</p><p>{deal.lot?.commodity}</p></div>
            <div><p className="text-gray-400 text-xs">Amount</p><p>₹{deal.transaction?.amount?.toLocaleString('en-IN')}</p></div>
            <div><p className="text-gray-400 text-xs">Farmer</p><p>{deal.farmer?.name}</p></div>
            <div><p className="text-gray-400 text-xs">Buyer</p><p>{deal.buyer?.name}</p></div>
          </div>
          {deal.transaction && (
            <div className="mt-3 text-sm">
              <p>Escrow: <strong className={deal.transaction.escrow_status === 'HELD' ? 'text-orange-600' : 'text-green-600'}>{deal.transaction.escrow_status}</strong></p>
            </div>
          )}
        </div>
      )}

      {/* Admin resolution panel */}
      {isAdmin && dispute.status === 'OPEN' && (
        <div className="card border-2 border-brand-200">
          <h3 className="mb-4 text-brand-800">🏛️ Admin Resolution</h3>
          <form onSubmit={handleResolve} className="space-y-4">
            <div>
              <label className="label">{t('dispute.action_label')}</label>
              <select className="input" value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))}>
                <option value="RELEASE_ESCROW">{t('dispute.actions.RELEASE_ESCROW')}</option>
                <option value="REFUND_BUYER">{t('dispute.actions.REFUND_BUYER')}</option>
                <option value="PARTIAL_RELEASE">{t('dispute.actions.PARTIAL_RELEASE')}</option>
              </select>
            </div>
            <div>
              <label className="label">{t('dispute.resolution_label')} *</label>
              <textarea className="input resize-none" rows={4} placeholder="Explain the resolution..."
                value={form.resolution} onChange={e => setForm(f => ({ ...f, resolution: e.target.value }))} required />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={resolving}>
              {resolving ? 'Resolving...' : t('dispute.resolve_btn')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
