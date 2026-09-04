import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { disputes as disputesApi } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { PageSpinner } from '../components/Spinner';
import Alert from '../components/Alert';

export default function DisputeFlow() {
  const { t } = useTranslation();
  const [disputesList, setDisputesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    disputesApi.list()
      .then(({ data }) => setDisputesList(data.disputes || []))
      .catch(() => setError(t('common.error')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner />;

  return (
    <div>
      <h1 className="mb-6">{t('nav.disputes')}</h1>
      {error && <Alert type="error" message={error} />}

      {disputesList.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-2">✅</p>
          <p className="text-gray-500">No disputes. Confirm handoffs from your deals page.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputesList.map(d => (
            <div key={d.dispute_id} className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <p className="font-semibold">{d.reason}</p>
                  <StatusBadge status={d.status} />
                </div>
                <p className="text-sm text-gray-500">Deal token: {d.deal?.token}</p>
                <p className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString('en-IN')}</p>
              </div>
              <Link to={`/disputes/${d.dispute_id}`} className="btn-secondary text-sm whitespace-nowrap">View Details</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
