import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { farmers } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { PageSpinner } from '../components/Spinner';
import Alert from '../components/Alert';

export default function FarmerDeals() {
  const { t } = useTranslation();
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    farmers.getLots({ limit: 50 })
      .then(({ data }) => setLots(data.lots?.filter(l => l.deal) || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner />;

  return (
    <div>
      <h1 className="mb-6">{t('nav.my_deals')}</h1>
      {lots.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-2">🤝</p>
          <p className="text-gray-500">No deals yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lots.map(lot => (
            <div key={lot.lot_id} className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold">{lot.commodity} — {lot.quantity} qtl</p>
                <p className="text-sm text-gray-500">Token: <span className="font-mono font-bold">{lot.deal.token}</span></p>
                <StatusBadge status={lot.deal.status} />
              </div>
              <Link to={`/farmer/deals/${lot.deal.deal_id}`} className="btn-secondary text-sm whitespace-nowrap">View Deal</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
