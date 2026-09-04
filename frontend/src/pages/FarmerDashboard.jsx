import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { farmers } from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import Alert from '../components/Alert';
import { PageSpinner } from '../components/Spinner';

export default function FarmerDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [lots,   setLots]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,  setError]  = useState('');

  useEffect(() => {
    farmers.getLots({ page: 1, limit: 50 })
      .then(({ data }) => setLots(data.lots || []))
      .catch(() => setError(t('common.error')))
      .finally(() => setLoading(false));
  }, []);

  const activeLots   = lots.filter(l => l.status === 'ACTIVE').length;
  const pendingOffers= lots.reduce((n, l) => n + (l.offers?.length || 0), 0);
  const lockedLots   = lots.filter(l => l.status === 'LOCKED').length;

  if (loading) return <PageSpinner />;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1>{t('farmer.dashboard_title')}</h1>
          <p className="text-gray-500 text-sm">{t('farmer.welcome', { name: user?.name || '' })}</p>
        </div>
        <Link to="/farmer/lots/create" className="btn-primary inline-flex items-center gap-2 self-start">
          <span>+</span> {t('farmer.create_lot_btn')}
        </Link>
      </div>

      {!user?.aadhaar_verified && (
        <Alert type="warning" message={`${t('auth.kyc_required')} — `} />
      )}
      {error && <Alert type="error" message={error} />}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label={t('farmer.active_lots')}   value={activeLots}   icon="🌾" color="brand" />
        <StatCard label={t('farmer.pending_offers')} value={pendingOffers} icon="📩" color="orange" />
        <StatCard label={t('farmer.active_deals')}  value={lockedLots}   icon="🤝" color="blue" />
        <StatCard label="Total Listings" value={lots.length} icon="📋" color="purple" />
      </div>

      {/* KYC prompt */}
      {!user?.aadhaar_verified && (
        <div className="card bg-yellow-50 border-yellow-200 mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-yellow-800">⚠️ Complete Aadhaar e-KYC</p>
            <p className="text-sm text-yellow-700">You need to verify your identity before listing produce.</p>
          </div>
          <Link to="/kyc" className="btn-primary whitespace-nowrap">Verify Now</Link>
        </div>
      )}

      {/* Recent lots */}
      <div>
        <h2 className="mb-4">My Recent Lots</h2>
        {lots.length === 0 ? (
          <div className="card text-center py-12 text-gray-500">
            <p className="text-4xl mb-3">🌱</p>
            <p>{t('farmer.no_lots')}</p>
            <Link to="/farmer/lots/create" className="btn-primary mt-4 inline-block">{t('farmer.create_lot_btn')}</Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lots.slice(0, 9).map(lot => (
              <Link key={lot.lot_id} to={`/farmer/lots/${lot.lot_id}`} className="card hover:shadow-md transition-shadow cursor-pointer block">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{lot.commodity} {lot.variety && `(${lot.variety})`}</p>
                    <p className="text-sm text-gray-500">{lot.district} · Grade {lot.grade}</p>
                  </div>
                  <StatusBadge status={lot.status} />
                </div>
                <div className="text-2xl font-bold text-brand-700 mb-1">₹{lot.asking_price}<span className="text-sm font-normal text-gray-500">/qtl</span></div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>{lot.quantity} qtl</span>
                  {lot.organic_flag && <span className="text-green-600 font-medium">🌿 Organic</span>}
                </div>
                {lot.offers?.length > 0 && (
                  <div className="mt-2 text-xs text-orange-600 font-medium">📩 {lot.offers.length} pending offer{lot.offers.length > 1 ? 's' : ''}</div>
                )}
              </Link>
            ))}
          </div>
        )}
        {lots.length > 9 && (
          <div className="text-center mt-4">
            <Link to="/farmer/lots" className="btn-secondary">View all {lots.length} lots →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
