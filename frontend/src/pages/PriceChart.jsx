import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { prices } from '../api/client';
import { PageSpinner } from '../components/Spinner';
import Alert from '../components/Alert';

const COMMODITIES = ['Wheat', 'Onion', 'Soybean', 'Cotton', 'Rice'];
const REGIONS = ['Pune', 'Nashik', 'Aurangabad', 'Ahmednagar', 'Latur'];
const DAY_OPTIONS = [30, 60, 90];

const TREND_STYLES = {
  UP:     { bg: 'bg-green-50  border-green-300  text-green-800',  icon: '📈' },
  DOWN:   { bg: 'bg-red-50    border-red-300    text-red-800',    icon: '📉' },
  STABLE: { bg: 'bg-blue-50   border-blue-300   text-blue-800',   icon: '➡️' },
};

export default function PriceChart() {
  const { t } = useTranslation();

  const [commodity, setCommodity] = useState('Wheat');
  const [region,    setRegion]    = useState('Pune');
  const [days,      setDays]      = useState(30);
  const [trendData, setTrendData] = useState([]);
  const [rec,       setRec]       = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  async function fetchData() {
    setLoading(true); setError('');
    try {
      const [trendRes, recRes] = await Promise.all([
        prices.trend({ commodity, region, days }),
        prices.recommendation({ commodity, region }),
      ]);
      setTrendData(trendRes.data.trend.map(p => ({
        date: new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        mandi_price: parseFloat(p.mandi_price?.toFixed(2)),
        msp_price: p.msp_price ? parseFloat(p.msp_price) : null,
      })));
      setRec(recRes.data);
    } catch {
      setError('Failed to load price data. Make sure the backend is running.');
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, [commodity, region, days]);

  const latestPrice = trendData[trendData.length - 1];
  const trendStyle = rec ? TREND_STYLES[rec.trend] || TREND_STYLES.STABLE : null;

  return (
    <div>
      <h1 className="mb-6">{t('price.title')}</h1>

      {error && <Alert type="error" message={error} />}

      {/* Controls */}
      <div className="card mb-5">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">{t('price.commodity_label')}</label>
            <select className="input" value={commodity} onChange={e => setCommodity(e.target.value)}>
              {COMMODITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('price.region_label')}</label>
            <select className="input" value={region} onChange={e => setRegion(e.target.value)}>
              {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('price.days_label')}</label>
            <div className="flex gap-2">
              {DAY_OPTIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    days === d ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-brand-300'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Current prices */}
      {latestPrice && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
          <div className="card bg-brand-50 border-brand-200">
            <p className="text-xs text-brand-600 uppercase">Latest Mandi Price</p>
            <p className="text-3xl font-bold text-brand-700">₹{latestPrice.mandi_price}</p>
            <p className="text-xs text-gray-500">/quintal</p>
          </div>
          {latestPrice.msp_price && (
            <div className="card bg-blue-50 border-blue-200">
              <p className="text-xs text-blue-600 uppercase">Govt. MSP</p>
              <p className="text-3xl font-bold text-blue-700">₹{latestPrice.msp_price}</p>
              <p className="text-xs text-gray-500">/quintal</p>
            </div>
          )}
          {latestPrice.msp_price && (
            <div className="card bg-orange-50 border-orange-200">
              <p className="text-xs text-orange-600 uppercase">Mandi vs MSP</p>
              <p className={`text-3xl font-bold ${latestPrice.mandi_price >= latestPrice.msp_price ? 'text-green-700' : 'text-red-700'}`}>
                {latestPrice.mandi_price >= latestPrice.msp_price ? '+' : ''}
                {((latestPrice.mandi_price - latestPrice.msp_price) / latestPrice.msp_price * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">relative to MSP</p>
            </div>
          )}
        </div>
      )}

      {/* Recommendation */}
      {rec && trendStyle && (
        <div className={`rounded-xl border-2 p-4 mb-5 ${trendStyle.bg}`}>
          <div className="flex items-start gap-3">
            <span className="text-2xl">{trendStyle.icon}</span>
            <div>
              <p className="font-semibold mb-1">Market Insight — {commodity} in {region}</p>
              <p className="text-sm">{rec.recommendation}</p>
              {rec.changePct && <p className="text-xs mt-1 opacity-75">Price change vs. 7 days ago: {rec.changePct > 0 ? '+' : ''}{rec.changePct}%</p>}
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="card">
        <h3 className="mb-4">{commodity} — {region} ({days}-day trend)</h3>
        {loading ? <PageSpinner /> : trendData.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No price data available for this selection.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={Math.floor(trendData.length / 7)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v}`} domain={['auto', 'auto']} />
              <Tooltip
                formatter={(value, name) => [`₹${value}/qtl`, name === 'mandi_price' ? 'Mandi Price' : 'MSP']}
                labelStyle={{ fontWeight: 600 }}
              />
              <Legend formatter={v => v === 'mandi_price' ? t('price.mandi_line') : t('price.msp_line')} />
              <Line type="monotone" dataKey="mandi_price" stroke="#16a34a" strokeWidth={2} dot={false} name="mandi_price" />
              {trendData.some(d => d.msp_price) && (
                <Line type="monotone" dataKey="msp_price" stroke="#2563eb" strokeWidth={2} strokeDasharray="5 5" dot={false} name="msp_price" />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
        <p className="text-xs text-gray-400 mt-3 text-center">
          Source: Mock Agmarknet data (refreshed daily by cron) · MSP: Ministry of Agriculture, Govt. of India
        </p>
      </div>
    </div>
  );
}
