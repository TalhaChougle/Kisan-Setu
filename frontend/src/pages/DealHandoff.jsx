import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { deals as dealsApi, disputes as disputesApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Alert from '../components/Alert';
import { PageSpinner } from '../components/Spinner';

export default function DealHandoff() {
  const { dealId } = useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [deal,    setDeal]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [handoffForm, setHandoffForm] = useState({ confirmed_quantity: '', confirmed_grade: 'A' });
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [showDispute, setShowDispute] = useState(false);
  const [disputeForm, setDisputeForm] = useState({ reason: '', description: '', evidence_url: '' });

  async function load() {
    try {
      const { data } = await dealsApi.get(dealId);
      setDeal(data.deal);
    } catch { setError(t('common.error')); }
    finally  { setLoading(false); }
  }

  useEffect(() => { load(); }, [dealId]);

  const isFarmer = user?.role === 'FARMER';
  const isBuyer  = user?.role === 'BUYER';

  const hasConfirmed = deal && (
    (isFarmer && deal.farmer_confirmed_at) ||
    (isBuyer  && deal.buyer_confirmed_at)
  );

  async function handleConfirm(e) {
    e.preventDefault();
    setConfirming(true); setError('');
    try {
      const { data } = await dealsApi.confirmHandoff(dealId, {
        confirmed_quantity: parseFloat(handoffForm.confirmed_quantity),
        confirmed_grade: handoffForm.confirmed_grade,
      });
      setSuccess(data.message);
      setDeal(data.deal);
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    } finally { setConfirming(false); }
  }

  async function handleDispute(e) {
    e.preventDefault();
    try {
      const { data } = await disputesApi.raise({ deal_id: dealId, ...disputeForm });
      setSuccess('Dispute raised. Escrow frozen pending admin review.');
      setShowDispute(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    }
  }

  if (loading) return <PageSpinner />;
  if (!deal) return <Alert type="error" message="Deal not found." />;

  const isCompleted = deal.status === 'COMPLETED';
  const isDisputed  = deal.status === 'DISPUTED';

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800 mb-4 block">← Back</button>

      {error   && <Alert type="error"   message={error}   onClose={() => setError('')} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

      {/* Deal Summary */}
      <div className="card mb-5">
        <div className="flex justify-between items-start mb-4">
          <h1>{t('deal.title')}</h1>
          <StatusBadge status={deal.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div><p className="text-xs text-gray-400">Commodity</p><p className="font-semibold">{deal.lot?.commodity} Grade {deal.lot?.grade}</p></div>
          <div><p className="text-xs text-gray-400">Quantity</p><p className="font-semibold">{deal.quantity} qtl</p></div>
          <div><p className="text-xs text-gray-400">Final Price</p><p className="font-semibold text-brand-700">₹{deal.final_price}/qtl</p></div>
          <div><p className="text-xs text-gray-400">Total Amount</p><p className="font-semibold">₹{deal.total_amount?.toLocaleString('en-IN')}</p></div>
        </div>

        {/* Token */}
        <div className="bg-brand-50 border-2 border-brand-300 rounded-xl p-4 text-center mb-4">
          <p className="text-xs text-brand-600 uppercase tracking-widest mb-1">{t('deal.token')}</p>
          <p className="text-3xl font-mono font-bold text-brand-800 tracking-wider">{deal.token}</p>
          <p className="text-xs text-brand-600 mt-2">{t('deal.token_hint')}</p>
        </div>

        {/* Handoff window */}
        <div className="flex gap-4 text-sm text-gray-600">
          <span>📅 Start: {new Date(deal.handoff_window_start).toLocaleDateString('en-IN')}</span>
          <span>⏰ Deadline: <strong className="text-orange-600">{new Date(deal.handoff_window_end).toLocaleDateString('en-IN')}</strong></span>
        </div>

        {/* Confirmation status */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className={`rounded-lg p-3 text-center text-sm ${deal.farmer_confirmed_at ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
            👨‍🌾 Farmer: {deal.farmer_confirmed_at ? `✅ Confirmed` : '⏳ Pending'}
          </div>
          <div className={`rounded-lg p-3 text-center text-sm ${deal.buyer_confirmed_at ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
            🏢 Buyer: {deal.buyer_confirmed_at ? `✅ Confirmed` : '⏳ Pending'}
          </div>
        </div>

        {/* Transaction info */}
        {deal.transaction && (
          <div className="mt-4 text-sm text-gray-600 border-t pt-3">
            <p>💰 Escrow: <strong>{deal.transaction.escrow_status}</strong> — ₹{deal.total_amount?.toLocaleString('en-IN')}</p>
            {deal.transaction.escrow_status === 'RELEASED' && (
              <p className="text-green-700">✅ Farmer payout: ₹{deal.transaction.farmer_payout?.toFixed(2)}</p>
            )}
            <p className="text-xs text-gray-400">Platform commission (2.5%): ₹{deal.transaction.commission_amount?.toFixed(2)}</p>
          </div>
        )}
      </div>

      {/* Parties */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Farmer</p>
          <p className="font-semibold">{deal.farmer?.name}</p>
          {deal.farmer?.mobile && <p className="text-sm text-gray-600">📱 {deal.farmer.mobile}</p>}
          <p className="text-sm text-gray-500">{deal.farmer?.village}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Buyer</p>
          <p className="font-semibold">{deal.buyer?.name}</p>
          {deal.buyer?.mobile && <p className="text-sm text-gray-600">📱 {deal.buyer.mobile}</p>}
        </div>
      </div>

      {/* Handoff confirmation form */}
      {!isCompleted && !isDisputed && !hasConfirmed && ['CONFIRMED', 'FARMER_CONFIRMED', 'BUYER_CONFIRMED'].includes(deal.status) && (
        <div className="card mb-5">
          <h3 className="mb-4">{t('deal.confirm_handoff')}</h3>
          <p className="text-sm text-gray-600 mb-4">Confirm physical pickup details. Both parties must confirm to release payment.</p>
          <form onSubmit={handleConfirm}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">{t('deal.quantity_confirmed')} *</label>
                <input className="input" type="number" min="0.1" step="0.1" placeholder={deal.quantity}
                  value={handoffForm.confirmed_quantity} onChange={e => setHandoffForm(f => ({ ...f, confirmed_quantity: e.target.value }))} required />
              </div>
              <div>
                <label className="label">{t('deal.grade_confirmed')} *</label>
                <select className="input" value={handoffForm.confirmed_grade} onChange={e => setHandoffForm(f => ({ ...f, confirmed_grade: e.target.value }))}>
                  <option value="A">Grade A</option>
                  <option value="B">Grade B</option>
                  <option value="C">Grade C</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={confirming}>
              {confirming ? 'Confirming...' : `✅ Confirm Handoff as ${isFarmer ? 'Farmer' : 'Buyer'}`}
            </button>
          </form>
        </div>
      )}

      {hasConfirmed && !isCompleted && (
        <div className="card bg-green-50 border-green-200 text-center py-6 mb-5">
          <p className="text-green-700 font-semibold">✅ You have confirmed handoff. Waiting for the other party.</p>
        </div>
      )}

      {isCompleted && (
        <div className="card bg-green-50 border-green-200 text-center py-8 mb-5">
          <p className="text-4xl mb-2">🎉</p>
          <p className="text-green-800 font-bold text-lg">Deal Completed!</p>
          <p className="text-green-700 text-sm mt-1">Escrow has been released to the farmer.</p>
        </div>
      )}

      {/* Dispute button */}
      {!isCompleted && !isDisputed && ['CONFIRMED','FARMER_CONFIRMED','BUYER_CONFIRMED'].includes(deal.status) && (
        <div>
          {!showDispute ? (
            <button onClick={() => setShowDispute(true)} className="btn-danger w-full">
              ⚠️ {t('dispute.raise_btn')}
            </button>
          ) : (
            <div className="card border-red-200 bg-red-50">
              <h3 className="text-red-800 mb-4">Raise a Dispute</h3>
              <form onSubmit={handleDispute} className="space-y-3">
                <div>
                  <label className="label">{t('dispute.reason_label')} *</label>
                  <input className="input" placeholder="e.g. Grade mismatch, non-payment, no-show"
                    value={disputeForm.reason} onChange={e => setDisputeForm(f => ({ ...f, reason: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">{t('dispute.description_label')}</label>
                  <textarea className="input resize-none" rows={3} value={disputeForm.description}
                    onChange={e => setDisputeForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div>
                  <label className="label">{t('dispute.evidence_label')}</label>
                  <input className="input" type="url" placeholder="https://..." value={disputeForm.evidence_url}
                    onChange={e => setDisputeForm(f => ({ ...f, evidence_url: e.target.value }))} />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowDispute(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn-danger flex-1">{t('dispute.submit_btn')}</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {isDisputed && deal.disputes?.[0] && (
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-800 font-semibold">⚠️ Dispute Open — Escrow Frozen</p>
          <p className="text-sm text-red-700 mt-1">Reason: {deal.disputes[0].reason}</p>
          <Link to={`/disputes/${deal.disputes[0].dispute_id}`} className="text-red-600 hover:underline text-sm mt-2 inline-block">View dispute details →</Link>
        </div>
      )}
    </div>
  );
}
