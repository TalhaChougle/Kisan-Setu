import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buyers } from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { PageSpinner } from '../components/Spinner';
import Alert from '../components/Alert';

export default function BuyerDashboard() {
  const { t } = useTranslation();
  const { user, isVerifiedBuyer } = useAuth();
  const [offers, setOffers] = useState([]);
  const [deals,  setDeals]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([buyers.getOffers(), buyers.getDeals()])
      .then(([ofRes, dealRes]) => {
        setOffers(ofRes.data.offers || []);
        setDeals(dealRes.data.deals  || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner />;

  const pendingOffers = offers.filter(o => o.status === 'PENDING').length;
  const activeDeals   = deals.filter(d => ['CONFIRMED','FARMER_CONFIRMED','BUYER_CONFIRMED'].includes(d.status)).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>{t('buyer.dashboard_title')}</h1>
          <p className="text-gray-500 text-sm">{user?.name}</p>
        </div>
        <Link to="/buyer/search" className="btn-primary">Browse Lots</Link>
      </div>

      {/* Onboarding banners */}
      {!user?.aadhaar_verified && (
        <div className="card bg-yellow-50 border-yellow-200 flex items-center justify-between gap-4 mb-5">
          <p className="text-yellow-800 font-medium">⚠️ Complete Aadhaar e-KYC to get started</p>
          <Link to="/buyer/kyc" className="btn-primary whitespace-nowrap">Verify Now</Link>
        </div>
      )}
      {user?.aadhaar_verified && !isVerifiedBuyer && (
        <div className="card bg-orange-50 border-orange-200 flex items-center justify-between gap-4 mb-5">
          <div>
            <p className="text-orange-800 font-semibold">🏅 Complete Business Verification</p>
            <p className="text-sm text-orange-700">{t('buyer.unverified_notice')}</p>
          </div>
          <Link to="/buyer/verify" className="btn-primary whitespace-nowrap">Upload Proof</Link>
        </div>
      )}
      {isVerifiedBuyer && (
        <div className="card bg-green-50 border-green-200 flex items-center gap-3 mb-5 py-3">
          <span className="text-2xl">🏅</span>
          <p className="text-green-800 font-medium">{t('buyer.verified_badge')} — You can make offers and view farmer contacts.</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label={t('buyer.offers_made')}  value={offers.length}  icon="📩" color="orange" />
        <StatCard label="Pending Responses"        value={pendingOffers}  icon="⏳" color="yellow" />
        <StatCard label={t('buyer.active_deals')} value={activeDeals}    icon="🤝" color="blue"   />
        <StatCard label="Completed Deals"          value={deals.filter(d => d.status === 'COMPLETED').length} icon="✅" color="brand" />
      </div>

      {/* Recent offers */}
      {offers.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3">Recent Offers</h2>
          <div className="space-y-2">
            {offers.slice(0, 5).map(offer => (
              <div key={offer.offer_id} className="card py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{offer.lot?.commodity} — ₹{offer.price}/qtl</p>
                  <p className="text-sm text-gray-500">{offer.lot?.district} · Grade {offer.lot?.grade}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={offer.status} />
                  <Link to={`/buyer/lots/${offer.lot?.lot_id}`} className="text-brand-600 text-sm hover:underline">View</Link>
                </div>
              </div>
            ))}
          </div>
          {offers.length > 5 && <Link to="/buyer/offers" className="text-brand-600 text-sm mt-2 inline-block">View all offers →</Link>}
        </div>
      )}

      {/* Recent deals */}
      {deals.length > 0 && (
        <div>
          <h2 className="mb-3">Active Deals</h2>
          <div className="space-y-2">
            {deals.filter(d => d.status !== 'COMPLETED').map(deal => (
              <div key={deal.deal_id} className="card py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{deal.lot?.commodity} — {deal.quantity} qtl @ ₹{deal.final_price}/qtl</p>
                  <p className="text-sm text-brand-600 font-mono font-semibold">Token: {deal.token}</p>
                  <p className="text-xs text-gray-500">Handoff by: {new Date(deal.handoff_window_end).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={deal.status} />
                  <Link to={`/buyer/deals/${deal.deal_id}`} className="btn-secondary text-sm">Confirm Handoff</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
