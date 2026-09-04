import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import { admin as adminApi, prices as pricesApi } from '../api/client';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { PageSpinner } from '../components/Spinner';
import Alert from '../components/Alert';

const COLORS = ['#16a34a', '#2563eb', '#f97316', '#ef4444', '#8b5cf6'];

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [stats,    setStats]    = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [fraud,    setFraud]    = useState([]);
  const [priceData, setPriceData] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [priceFilter, setPriceFilter] = useState({ commodity: 'Wheat', days: 30 });

  useEffect(() => {
    Promise.all([
      adminApi.dashboard(),
      adminApi.disputes({ status: 'OPEN', limit: 5 }),
      adminApi.fraudFlags(),
    ]).then(([dashRes, dispRes, fraudRes]) => {
      setStats(dashRes.data.stats);
      setDisputes(dispRes.data.disputes || []);
      setFraud(fraudRes.data.flagged_buyers || []);
    }).catch(() => setError(t('common.error')))
    .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    adminApi.regionalPrices({ commodity: priceFilter.commodity, days: priceFilter.days })
      .then(({ data }) => {
        // Flatten for chart — just use first region for now
        const regions = Object.entries(data.regions || {});
        if (regions.length === 0) { setPriceData([]); return; }
        // Build multi-series data from all regions
        const allDates = [...new Set(regions.flatMap(([, pts]) => pts.map(p => p.date)))].sort();
        const chartData = allDates.map(date => {
          const row = { date: new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) };
          regions.forEach(([region, pts]) => {
            const pt = pts.find(p => p.date === date);
            if (pt) row[region] = parseFloat(pt.mandi_price?.toFixed(0));
          });
          return row;
        });
        // Sample every 3rd point for readability
        setPriceData(chartData.filter((_, i) => i % 3 === 0));
      })
      .catch(() => {});
  }, [priceFilter]);

  if (loading) return <PageSpinner />;

  const regionKeys = priceData.length > 0 ? Object.keys(priceData[0]).filter(k => k !== 'date') : [];

  // Deal status breakdown for pie
  const dealPie = stats ? [
    { name: 'Active',    value: stats.deals.total - stats.deals.completed },
    { name: 'Completed', value: stats.deals.completed },
  ] : [];

  return (
    <div>
      <h1 className="mb-2">{t('admin.dashboard_title')}</h1>
      <p className="text-gray-500 text-sm mb-6">Real-time oversight — Problem Statement ID: 26132</p>

      {error && <Alert type="error" message={error} />}

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label={t('admin.total_farmers')}    value={stats?.users.farmers}          icon="👨‍🌾" color="brand" />
        <StatCard label={t('admin.total_buyers')}     value={stats?.users.buyers}           icon="🏢"  color="blue" />
        <StatCard label={t('admin.active_lots')}      value={stats?.lots.active}            icon="🌾"  color="orange" />
        <StatCard label={t('admin.open_disputes')}    value={stats?.disputes.open}          icon="⚠️"  color="red" />
        <StatCard label={t('admin.total_deals')}      value={stats?.deals.total}            icon="🤝"  color="purple" />
        <StatCard label={t('admin.completed_deals')}  value={stats?.deals.completed}        icon="✅"  color="brand" />
        <StatCard
          label={t('admin.transaction_volume')}
          value={`₹${(stats?.finance.totalTransactionVolume / 100000).toFixed(1)}L`}
          icon="💰"
          color="orange"
          sub="Lakhs INR"
        />
        <StatCard
          label={t('admin.avg_realisation')}
          value={stats?.finance.avgFarmerRealisation ? `₹${stats.finance.avgFarmerRealisation.toFixed(0)}` : '—'}
          icon="📊"
          color="blue"
          sub={`vs MSP: ${stats?.finance.avgFinalVsMspPct || 'N/A'}`}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Regional price trend chart */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3>Regional Price Trends</h3>
            <div className="flex gap-2">
              <select className="input text-xs py-1 px-2 w-28" value={priceFilter.commodity} onChange={e => setPriceFilter(f => ({ ...f, commodity: e.target.value }))}>
                {['Wheat', 'Onion', 'Soybean', 'Cotton', 'Rice'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="input text-xs py-1 px-2 w-16" value={priceFilter.days} onChange={e => setPriceFilter(f => ({ ...f, days: parseInt(e.target.value) }))}>
                <option value={30}>30d</option>
                <option value={60}>60d</option>
                <option value={90}>90d</option>
              </select>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={priceData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(priceData.length / 5)} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${v}`} />
              <Tooltip formatter={v => `₹${v}/qtl`} />
              <Legend iconSize={10} />
              {regionKeys.map((region, i) => (
                <Line key={region} type="monotone" dataKey={region} stroke={COLORS[i % COLORS.length]} strokeWidth={1.5} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Deal status pie */}
        <div className="card flex flex-col items-center justify-center">
          <h3 className="mb-4 self-start">Deal Breakdown</h3>
          <PieChart width={180} height={180}>
            <Pie data={dealPie} cx={90} cy={90} innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
              {dealPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
          <div className="flex gap-4 mt-2 text-sm">
            {dealPie.map((item, i) => (
              <div key={item.name} className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full inline-block" style={{ background: COLORS[i] }} />
                <span>{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Open disputes */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2>Open Disputes</h2>
          <Link to="/admin/disputes" className="text-brand-600 text-sm hover:underline">View all →</Link>
        </div>
        {disputes.length === 0 ? (
          <div className="card text-center py-6 text-gray-500">No open disputes 🎉</div>
        ) : (
          <div className="space-y-2">
            {disputes.map(d => (
              <div key={d.dispute_id} className="card flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{d.reason}</p>
                  <p className="text-sm text-gray-500">{d.deal?.lot?.commodity} · {d.deal?.farmer?.name} ↔ {d.deal?.buyer?.name}</p>
                  <p className="text-xs text-gray-400">{new Date(d.created_at).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={d.status} />
                  <Link to={`/disputes/${d.dispute_id}`} className="btn-primary text-sm">{t('admin.resolve_dispute')}</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fraud flags */}
      {fraud.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 text-red-700">⚠️ {t('admin.fraud_flags')}</h2>
          <p className="text-sm text-gray-500 mb-4">{t('admin.fraud_desc')}</p>
          <div className="space-y-2">
            {fraud.map(b => (
              <div key={b.buyer.buyer_id} className="card bg-red-50 border-red-200 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-red-800">{b.buyer.name}</p>
                  <p className="text-sm text-red-600">{b.count} suspicious offer{b.count > 1 ? 's' : ''} below 90% MSP</p>
                  <p className="text-xs text-gray-500">{b.buyer.mobile}</p>
                </div>
                <div className="text-right">
                  {b.offers.slice(0, 2).map(o => (
                    <p key={o.offer_id} className="text-xs text-red-600">₹{o.price} vs MSP ₹{o.msp} — {o.commodity}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid sm:grid-cols-3 gap-4">
        <Link to="/admin/disputes" className="card hover:shadow-md transition-shadow text-center py-5">
          <p className="text-3xl mb-2">⚖️</p>
          <p className="font-medium">Dispute Management</p>
          <p className="text-sm text-gray-500 mt-1">{stats?.disputes.open} open cases</p>
        </Link>
        <Link to="/admin/audit" className="card hover:shadow-md transition-shadow text-center py-5">
          <p className="text-3xl mb-2">📋</p>
          <p className="font-medium">{t('admin.view_audit')}</p>
          <p className="text-sm text-gray-500 mt-1">Immutable activity log</p>
        </Link>
        <Link to="/prices" className="card hover:shadow-md transition-shadow text-center py-5">
          <p className="text-3xl mb-2">📊</p>
          <p className="font-medium">Price Intelligence</p>
          <p className="text-sm text-gray-500 mt-1">Mandi & MSP trends</p>
        </Link>
      </div>
    </div>
  );
}
