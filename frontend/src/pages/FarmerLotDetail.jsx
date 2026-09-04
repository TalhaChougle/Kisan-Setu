import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { farmers, lots as lotsApi } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import Alert from '../components/Alert';
import { PageSpinner } from '../components/Spinner';

export default function FarmerLotDetail() {
  const { lotId } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [lot,     setLot]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [actionLoading, setActionLoading] = useState('');

  async function load() {
    setLoading(true);
    try {
      const { data } = await farmers.getLot(lotId);
      setLot(data.lot);
    } catch { setError(t('common.error')); }
    finally  { setLoading(false); }
  }

  useEffect(() => { load(); }, [lotId]);

  async function handleWithdraw() {
    if (!confirm('Withdraw this lot? This cannot be undone.')) return;
    setActionLoading('withdraw');
    try {
      await farmers.withdrawLot(lotId);
      setLot(l => ({ ...l, status: 'WITHDRAWN' }));
    } catch (e) { setError(e.response?.data?.message || t('common.error')); }
    finally { setActionLoading(''); }
  }

  async function handleAccept(offerId) {
    setActionLoading(offerId);
    try {
      const { data } = await lotsApi.acceptOffer(lotId, offerId);
      alert(`Deal confirmed! Token: ${data.token}`);
      navigate(`/farmer/deals/${data.deal.deal_id}`);
    } catch (e) { setError(e.response?.data?.message || t('common.error')); }
    finally { setActionLoading(''); }
  }

  async function handleReject(offerId) {
    setActionLoading(offerId + '_rej');
    try {
      await lotsApi.rejectOffer(lotId, offerId);
      await load();
    } catch (e) { setError(e.response?.data?.message || t('common.error')); }
    finally { setActionLoading(''); }
  }

  const [counterPrice, setCounterPrice] = useState({});
  async function handleCounter(offerId) {
    const price = counterPrice[offerId];
    if (!price) return;
    setActionLoading(offerId + '_ctr');
    try {
      await lotsApi.counterOffer(lotId, offerId, { price: parseFloat(price) });
      setCounterPrice(p => ({ ...p, [offerId]: '' }));
      await load();
    } catch (e) { setError(e.response?.data?.message || t('common.error')); }
    finally { setActionLoading(''); }
  }

  if (loading) return <PageSpinner />;
  if (!lot) return <Alert type="error" message="Lot not found." />;

  const pendingOffers = lot.offers?.filter(o => o.status === 'PENDING') || [];
  const allOffers     = lot.offers || [];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">←</button>
        <h1>{lot.commodity} {lot.variety && `(${lot.variety})`}</h1>
        <StatusBadge status={lot.status} />
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {/* Lot details */}
      <div className="card mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div><p className="text-xs text-gray-500">Grade</p><p className="font-semibold">Grade {lot.grade}</p></div>
          <div><p className="text-xs text-gray-500">Quantity</p><p className="font-semibold">{lot.quantity} qtl</p></div>
          <div><p className="text-xs text-gray-500">Asking Price</p><p className="font-semibold text-brand-700">₹{lot.asking_price}/qtl</p></div>
          <div><p className="text-xs text-gray-500">District</p><p className="font-semibold">{lot.district}</p></div>
        </div>
        {lot.msp_at_listing && (
          <div className="flex gap-6 text-sm text-gray-600">
            <span>📊 MSP at listing: <strong>₹{lot.msp_at_listing}</strong></span>
            {lot.mandi_at_listing && <span>🏪 Mandi at listing: <strong>₹{lot.mandi_at_listing?.toFixed(0)}</strong></span>}
          </div>
        )}
        {lot.organic_flag && <p className="text-green-600 text-sm mt-2">🌿 Organic</p>}
        {lot.export_eligible && <p className="text-blue-600 text-sm">✈️ Export eligible</p>}

        <div className="flex gap-3 mt-4">
          {lot.status === 'ACTIVE' && (
            <>
              <Link to={`/farmer/lots/${lotId}/edit`} className="btn-secondary text-sm">✏️ Edit</Link>
              <button onClick={handleWithdraw} className="btn-danger text-sm" disabled={actionLoading === 'withdraw'}>
                {actionLoading === 'withdraw' ? 'Withdrawing...' : 'Withdraw Lot'}
              </button>
            </>
          )}
          {lot.deal && (
            <Link to={`/farmer/deals/${lot.deal.deal_id}`} className="btn-primary text-sm">View Deal →</Link>
          )}
        </div>
      </div>

      {/* Offers */}
      <div>
        <h2 className="mb-4">Offers ({allOffers.length})</h2>
        {allOffers.length === 0 ? (
          <div className="card text-center py-8 text-gray-500">{t('lot.no_offers')}</div>
        ) : (
          <div className="space-y-3">
            {allOffers.map(offer => (
              <div key={offer.offer_id} className="card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <p className="font-bold text-lg">₹{offer.price}/qtl</p>
                      <StatusBadge status={offer.status} />
                    </div>
                    <p className="text-sm text-gray-600">{offer.buyer?.name} — {offer.buyer?.business_proof_type?.replace(/_/g, ' ')}</p>
                    {offer.message && <p className="text-sm text-gray-500 mt-1 italic">"{offer.message}"</p>}
                    {offer.msp_at_offer && (
                      <p className="text-xs text-blue-600 mt-1">Govt. MSP at time of offer: ₹{offer.msp_at_offer}/qtl</p>
                    )}
                    <p className="text-xs text-gray-400">{new Date(offer.timestamp).toLocaleDateString('en-IN')}</p>
                  </div>

                  {offer.status === 'PENDING' && lot.status === 'ACTIVE' && (
                    <div className="flex flex-col gap-2 min-w-[200px]">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAccept(offer.offer_id)}
                          className="btn-primary text-sm flex-1"
                          disabled={!!actionLoading}
                        >
                          {actionLoading === offer.offer_id ? '...' : '✅ Accept'}
                        </button>
                        <button
                          onClick={() => handleReject(offer.offer_id)}
                          className="btn-danger text-sm flex-1"
                          disabled={!!actionLoading}
                        >
                          ❌ Reject
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          className="input text-sm"
                          type="number"
                          placeholder="Counter price"
                          value={counterPrice[offer.offer_id] || ''}
                          onChange={e => setCounterPrice(p => ({ ...p, [offer.offer_id]: e.target.value }))}
                        />
                        <button
                          onClick={() => handleCounter(offer.offer_id)}
                          className="btn-secondary text-sm whitespace-nowrap"
                          disabled={!counterPrice[offer.offer_id]}
                        >
                          Counter
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
