import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { admin as adminApi } from '../api/client';
import { PageSpinner } from '../components/Spinner';
import Alert from '../components/Alert';

const ACTION_COLORS = {
  LOT_CREATED:      'bg-green-100 text-green-700',
  DEAL_CONFIRMED:   'bg-blue-100 text-blue-700',
  DEAL_COMPLETED:   'bg-brand-100 text-brand-700',
  ESCROW_HELD:      'bg-orange-100 text-orange-700',
  ESCROW_RELEASED:  'bg-green-100 text-green-700',
  ESCROW_REFUNDED:  'bg-red-100 text-red-700',
  DISPUTE_RAISED:   'bg-red-100 text-red-700',
  DISPUTE_RESOLVED: 'bg-purple-100 text-purple-700',
  USER_REGISTERED:  'bg-gray-100 text-gray-600',
  USER_KYC_VERIFIED:'bg-blue-100 text-blue-600',
};

export default function AdminAudit() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(pg = 1) {
    setLoading(true);
    try {
      const { data } = await adminApi.auditLog({ page: pg, limit: 25 });
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setPage(pg);
    } catch { setError(t('common.error')); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(1); }, []);

  return (
    <div>
      <h1 className="mb-2">{t('admin.view_audit')}</h1>
      <p className="text-sm text-gray-500 mb-6">Immutable append-only audit trail — {total} entries</p>

      {error && <Alert type="error" message={error} />}
      {loading ? <PageSpinner /> : (
        <>
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id} className="flex gap-4 py-3 border-b border-gray-100 text-sm">
                <div className="w-40 text-gray-400 text-xs leading-tight">
                  {new Date(log.created_at).toLocaleDateString('en-IN')}<br/>
                  {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                      {log.action}
                    </span>
                    <span className="text-gray-500 text-xs">{log.entity_type} · {log.entity_id.slice(-8)}</span>
                  </div>
                  {log.actor_type && (
                    <p className="text-gray-500 text-xs">Actor: {log.actor_type} {log.actor_id?.slice(-8)}</p>
                  )}
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <pre className="text-xs text-gray-400 mt-1 font-mono overflow-x-auto">
                      {JSON.stringify(log.metadata, null, 2).slice(0, 200)}
                    </pre>
                  )}
                </div>
              </div>
            ))}
          </div>

          {total > 25 && (
            <div className="flex justify-center gap-3 mt-6">
              <button disabled={page === 1} onClick={() => load(page - 1)} className="btn-secondary text-sm">← Prev</button>
              <span className="py-2 text-sm text-gray-600">Page {page} of {Math.ceil(total / 25)}</span>
              <button disabled={page * 25 >= total} onClick={() => load(page + 1)} className="btn-secondary text-sm">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
