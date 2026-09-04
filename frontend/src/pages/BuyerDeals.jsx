import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buyers } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { PageSpinner } from '../components/Spinner';

export default function BuyerDeals() {
  const { t } = useTranslation();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    buyers.getDeals()
      .then(({ data }) => setDeals(data.deals || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner />;

  return (
    <div>
      <h1 className="mb-6">{t('nav.my_deals')}</h1>
      {deals.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-2">🤝</p>
          <p className="text-gray-500">No deals yet. Make an offer to start a deal.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deals.map(deal => (
            <div key={deal.deal_id} className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold">{deal.lot?.commodity} — {deal.quantity} qtl @ ₹{deal.final_price}/qtl</p>
                <p className="text-sm text-gray-500">Farmer: {deal.farmer?.name} · {deal.farmer?.village}</p>
                <p className="text-sm font-mono text-brand-700 font-bold mt-1">Token: {deal.token}</p>
                <p className="text-xs text-gray-400">Handoff by: {new Date(deal.handoff_window_end).toLocaleDateString('en-IN')}</p>
                <div className="flex items-center gap-3 mt-2">
                  <StatusBadge status={deal.status} />
                  {deal.transaction && <span className="text-xs text-gray-500">Escrow: {deal.transaction.escrow_status}</span>}
                </div>
              </div>
              <Link to={`/buyer/deals/${deal.deal_id}`} className="btn-secondary text-sm whitespace-nowrap">View / Confirm Handoff</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
