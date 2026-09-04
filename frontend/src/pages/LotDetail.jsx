import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buyers, lots as lotsApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import Alert from '../components/Alert';
import { PageSpinner } from '../components/Spinner';

export default function LotDetail() {
  const { lotId } = useParams();
  const { t } = useTranslation();
  const { isVerifiedBuyer } = useAuth();
  const navigate = useNavigate();

  const [lot,      setLot]      = useState(null);
  const [logistics, setLogistics] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [offering, setOffering] = useState(false);
  const [offerForm, setOfferForm] = useState({ price: '', message: '' });
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  useEffect(() => {
    Promise.all([
      buyers.getLot(lotId),
      lotsApi.getLogistics(lotId),
    ]).then(([lotRes, logRes]) => {
      setLot(lotRes.data.lot);
      setLogistics(logRes.data.logistics || []);
    }).catch(() => setError(t('common.error')))
    .finally(() => setLoading(false));
  }, [lotId]);

  async function handleOffer(e) {
    e.preventDefault();
    setOffering(true); setError('');
    try {
      await buyers.makeOffer(lotId, { price: parseFloat(offerForm.price), message: offerForm.message });
      setSuccess('Offer submitted successfully! The farmer will respond shortly.');
      setOfferForm({ price: '', message: '' });
      // Reload to show offer status
      const { data } = await buyers.getLot(lotId);
      setLot(data.lot);
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    } finally { setOffering(false); }
  }

  if (loading) return <PageSpinner />;
  if (!lot) return <Alert type="error" message="Lot not found." />;

  const myOffers = lot.offers || [];
  const latestOffer = myOffers[myOffers.length - 1];

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800 mb-4 block">← Back to Search</button>

      {error   && <Alert type="error"   message={error}   onClose={() => setError('')} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

      {/* Lot Info */}
      <div className="card mb-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1>{lot.commodity} {lot.variety && `(${lot.variety})`}</h1>
            <p className="text-gray-500">{lot.farmer?.district || lot.district}, Maharashtra</p>
          </div>
          <StatusBadge status={lot.status} />
        </div>

        {lot.photo_url && (
          <img src={lot.photo_url} alt={lot.commodity} className="w-full h-48 object-cover rounded-lg mb-4" onError={e => e.target.style.display='none'} />
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div><p className="text-xs text-gray-400">Grade</p><p className="font-semibold">Grade {lot.grade}</p></div>
          <div><p className="text-xs text-gray-400">Quantity</p><p className="font-semibold">{lot.quantity} qtl</p></div>
          <div><p className="text-xs text-gray-400">Asking Price</p><p className="font-semibold text-brand-700">₹{lot.asking_price}/qtl</p></div>
          <div><p className="text-xs text-gray-400">Season</p><p className="font-semibold capitalize">{lot.season}</p></div>
        </div>

        {/* Govt reference prices */}
        {lot.msp_at_listing && (
          <div className="bg-blue-50 rounded-lg px-4 py-3 flex gap-6 text-sm">
            <span className="text-blue-800">📊 <strong>Govt. MSP:</strong> ₹{lot.msp_at_listing}/qtl</span>
            {lot.mandi_at_listing && <span className="text-blue-700">🏪 <strong>Mandi:</strong> ₹{lot.mandi_at_listing?.toFixed(0)}/qtl</span>}
          </div>
        )}

        {/* Farmer info (verified buyers only) */}
        {isVerifiedBuyer && lot.farmer?.name && (
          <div className="mt-4 border-t pt-4">
            <p className="text-sm text-gray-500 mb-1">Farmer</p>
            <p className="font-medium">{lot.farmer.name}</p>
            {lot.farmer.mobile && <p className="text-sm text-gray-600">📱 {lot.farmer.mobile}</p>}
            <p className="text-sm text-gray-600">📍 {lot.farmer.village}, {lot.farmer.district}</p>
          </div>
        )}

        {lot.organic_flag  && <p className="text-green-600 text-sm mt-2">🌿 Organic produce</p>}
        {lot.export_eligible && <p className="text-blue-600 text-sm">✈️ Export eligible</p>}
      </div>

      {/* Negotiation thread */}
      {myOffers.length > 0 && (
        <div className="card mb-5">
          <h3 className="mb-4">Negotiation Thread</h3>
          <div className="space-y-3">
            {myOffers.map(offer => (
              <div key={offer.offer_id} className={`rounded-lg p-3 border ${
                offer.status === 'ACCEPTED' ? 'bg-green-50 border-green-300'
                : offer.status === 'REJECTED' ? 'bg-red-50 border-red-200'
                : offer.status === 'COUNTERED' ? 'bg-yellow-50 border-yellow-200'
                : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-lg">₹{offer.price}/qtl</span>
                    {offer.parent_id ? <span className="text-xs text-gray-500 ml-2">(counter offer)</span> : null}
                  </div>
                  <StatusBadge status={offer.status} />
                </div>
                {offer.message && <p className="text-sm text-gray-600 mt-1 italic">"{offer.message}"</p>}
                {offer.msp_at_offer && (
                  <p className="text-xs text-blue-600 mt-1">Govt. reference: ₹{offer.msp_at_offer}/qtl</p>
                )}
                <p className="text-xs text-gray-400 mt-1">{new Date(offer.timestamp).toLocaleString('en-IN')}</p>

                {offer.status === 'ACCEPTED' && (
                  <p className="text-green-700 font-medium text-sm mt-2">✅ Offer accepted! Proceed to your deals to get the handoff token.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Make offer panel */}
      {isVerifiedBuyer && lot.status === 'ACTIVE' && !myOffers.some(o => o.status === 'PENDING') && (
        <div className="card">
          <h3 className="mb-4">{t('offer.make_offer')}</h3>
          <form onSubmit={handleOffer}>
            <div className="mb-4">
              <label className="label">{t('offer.your_price')}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                <input
                  className="input pl-7"
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder={lot.asking_price}
                  value={offerForm.price}
                  onChange={e => setOfferForm(f => ({ ...f, price: e.target.value }))}
                  required
                />
              </div>
              {lot.msp_at_listing && (
                <p className="text-xs text-blue-600 mt-1">📊 {t('offer.govt_ref', { price: lot.msp_at_listing })}</p>
              )}
              {lot.asking_price && offerForm.price && parseFloat(offerForm.price) > lot.asking_price && (
                <p className="text-xs text-green-600 mt-1">Above asking price — likely to be accepted quickly.</p>
              )}
            </div>
            <div className="mb-4">
              <label className="label">{t('offer.message')}</label>
              <textarea
                className="input resize-none"
                rows={3}
                placeholder={t('offer.message_placeholder')}
                value={offerForm.message}
                onChange={e => setOfferForm(f => ({ ...f, message: e.target.value }))}
              />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={offering || !offerForm.price}>
              {offering ? 'Submitting...' : t('offer.submit')}
            </button>
          </form>
        </div>
      )}

      {!isVerifiedBuyer && (
        <div className="card bg-yellow-50 border-yellow-200 text-center py-8">
          <p className="text-yellow-800 font-medium mb-3">🏅 Verify your business to make offers</p>
          <button onClick={() => navigate('/buyer/verify')} className="btn-primary">Complete Verification</button>
        </div>
      )}

      {/* Logistics */}
      {logistics.length > 0 && (
        <div className="card mt-5">
          <h3 className="mb-3">🚛 {t('logistics.title')}</h3>
          <div className="space-y-2">
            {logistics.map(lo => (
              <div key={lo.id} className="flex justify-between items-center text-sm border-b border-gray-100 pb-2 last:border-0">
                <div>
                  <p className="font-medium">{lo.name}</p>
                  <p className="text-gray-500">{lo.address}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${lo.type === 'cold_storage' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                    {lo.type === 'cold_storage' ? '❄️ Cold Storage' : '🚛 Transport'}
                  </span>
                  {lo.contact && <p className="text-brand-600 mt-1">{lo.contact}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
