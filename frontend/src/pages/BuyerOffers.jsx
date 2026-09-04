import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buyers } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { PageSpinner } from '../components/Spinner';

export default function BuyerOffers() {
  const { t } = useTranslation();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    buyers.getOffers()
      .then(({ data }) => setOffers(data.offers || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner />;

  return (
    <div>
      <h1 className="mb-6">{t('nav.my_offers')}</h1>
      {offers.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-2">📩</p>
          <p className="text-gray-500">No offers yet. Browse lots to make your first offer.</p>
          <Link to="/buyer/search" className="btn-primary mt-4 inline-block">Browse Lots</Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-gray-500 text-xs uppercase">
                <th className="pb-3 text-left">Commodity</th>
                <th className="pb-3 text-right">Offered Price</th>
                <th className="pb-3 text-left">District</th>
                <th className="pb-3 text-left">Status</th>
                <th className="pb-3 text-left">Date</th>
                <th className="pb-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {offers.map(o => (
                <tr key={o.offer_id} className="hover:bg-gray-50">
                  <td className="py-3 font-medium">{o.lot?.commodity} {o.lot?.variety && `(${o.lot.variety})`}</td>
                  <td className="py-3 text-right font-semibold text-brand-700">₹{o.price}/qtl</td>
                  <td className="py-3 text-gray-500">{o.lot?.district}</td>
                  <td className="py-3"><StatusBadge status={o.status} /></td>
                  <td className="py-3 text-gray-400 text-xs">{new Date(o.timestamp).toLocaleDateString('en-IN')}</td>
                  <td className="py-3">
                    <Link to={`/buyer/lots/${o.lot?.lot_id}`} className="text-brand-600 hover:underline">View Lot</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
