import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { farmers } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { PageSpinner } from '../components/Spinner';
import Alert from '../components/Alert';

export default function FarmerLots() {
  const { t } = useTranslation();
  const [lots, setLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    farmers.getLots({ page: 1, limit: 50 })
      .then(({ data }) => setLots(data.lots || []))
      .catch(() => setError(t('common.error')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1>{t('nav.my_lots')}</h1>
        <Link to="/farmer/lots/create" className="btn-primary">+ {t('nav.create_lot')}</Link>
      </div>

      {error && <Alert type="error" message={error} />}

      {lots.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-4xl mb-3">🌾</p>
          <p className="text-gray-500">{t('farmer.no_lots')}</p>
          <Link to="/farmer/lots/create" className="btn-primary mt-4 inline-block">{t('farmer.create_lot_btn')}</Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wide">
                <th className="pb-3 text-left">Commodity</th>
                <th className="pb-3 text-left">Grade</th>
                <th className="pb-3 text-right">Qty (qtl)</th>
                <th className="pb-3 text-right">Price/qtl</th>
                <th className="pb-3 text-left">District</th>
                <th className="pb-3 text-left">Status</th>
                <th className="pb-3 text-left">Offers</th>
                <th className="pb-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lots.map(lot => (
                <tr key={lot.lot_id} className="hover:bg-gray-50">
                  <td className="py-3 font-medium">{lot.commodity}{lot.variety ? ` (${lot.variety})` : ''} {lot.organic_flag && <span className="text-green-600 text-xs">🌿</span>}</td>
                  <td className="py-3">Grade {lot.grade}</td>
                  <td className="py-3 text-right">{lot.quantity}</td>
                  <td className="py-3 text-right font-semibold text-brand-700">₹{lot.asking_price}</td>
                  <td className="py-3 text-gray-500">{lot.district}</td>
                  <td className="py-3"><StatusBadge status={lot.status} /></td>
                  <td className="py-3">
                    {lot.offers?.length > 0 ? (
                      <span className="text-orange-600 font-medium">{lot.offers.length} pending</span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="py-3">
                    <Link to={`/farmer/lots/${lot.lot_id}`} className="text-brand-600 hover:underline mr-3">View</Link>
                    {lot.status === 'ACTIVE' && (
                      <Link to={`/farmer/lots/${lot.lot_id}/edit`} className="text-gray-500 hover:underline">Edit</Link>
                    )}
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
