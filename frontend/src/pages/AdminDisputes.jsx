import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { admin as adminApi } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { PageSpinner } from '../components/Spinner';
import Alert from '../components/Alert';

export default function AdminDisputes() {
  const { t } = useTranslation();
  const [disputes, setDisputes] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');

  async function load(status = '') {
    setLoading(true);
    try {
      const { data } = await adminApi.disputes({ status: status || undefined, limit: 50 });
      setDisputes(data.disputes || []);
      setTotal(data.total || 0);
    } catch { setError(t('common.error')); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(statusFilter); }, [statusFilter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1>Dispute Management ({total})</h1>
        <select className="input w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="RESOLVED">Resolved</option>
        </select>
      </div>
      {error && <Alert type="error" message={error} />}
      {loading ? <PageSpinner /> : disputes.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">No disputes found.</div>
      ) : (
        <div className="space-y-3">
          {disputes.map(d => (
            <div key={d.dispute_id} className="card">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="font-semibold">{d.reason}</p>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm text-gray-600">
                    <span>🌾 {d.deal?.lot?.commodity}</span>
                    <span>👨‍🌾 {d.deal?.farmer?.name}</span>
                    <span>🏢 {d.deal?.buyer?.name}</span>
                    <span>💰 ₹{d.deal?.transaction?.amount?.toLocaleString('en-IN')}</span>
                  </div>
                  {d.description && <p className="text-sm text-gray-500 mt-2">{d.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">{new Date(d.created_at).toLocaleString('en-IN')}</p>
                </div>
                {d.status === 'OPEN' && (
                  <Link to={`/disputes/${d.dispute_id}`} className="btn-primary text-sm whitespace-nowrap">{t('admin.resolve_dispute')}</Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
