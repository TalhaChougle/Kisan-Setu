import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { farmers, prices } from '../api/client';
import Alert from '../components/Alert';

const COMMODITIES = ['Wheat', 'Onion', 'Soybean', 'Cotton', 'Rice', 'Maize', 'Sugarcane', 'Tomato'];
const DISTRICTS   = ['Pune', 'Nashik', 'Aurangabad', 'Ahmednagar', 'Latur', 'Osmanabad', 'Amravati', 'Raigad', 'Sindhudurg', 'Kolhapur'];

export default function LotCreate() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    commodity: '', variety: '', grade: 'A', quantity: '', asking_price: '',
    district: '', season: 'kharif', harvest_date: '', organic_flag: false, photo_url: '',
  });
  const [priceData, setPriceData]           = useState(null);
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading]               = useState(false);
  const [priceLoading, setPriceLoading]     = useState(false);
  const [error, setError]                   = useState('');
  const [success, setSuccess]               = useState('');

  // Fetch price when commodity+district selected
  useEffect(() => {
    if (!form.commodity || !form.district) return;
    setPriceLoading(true);
    Promise.all([
      prices.latest({ commodity: form.commodity, region: form.district }),
      prices.recommendation({ commodity: form.commodity, region: form.district }),
    ])
      .then(([priceRes, recRes]) => {
        setPriceData(priceRes.data.price);
        setRecommendation(recRes.data);
      })
      .catch(() => { setPriceData(null); setRecommendation(null); })
      .finally(() => setPriceLoading(false));
  }, [form.commodity, form.district]);

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.commodity || !form.asking_price || !form.quantity || !form.district) {
      setError('Please fill all required fields.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await farmers.createLot({
        ...form,
        quantity: parseFloat(form.quantity),
        asking_price: parseFloat(form.asking_price),
        harvest_date: form.harvest_date || undefined,
      });
      setSuccess('Lot published successfully!');
      setTimeout(() => navigate(`/farmer/lots/${data.lot.lot_id}`), 1200);
    } catch (err) {
      setError(err.response?.data?.errors?.join(', ') || err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  const trendColor = recommendation?.trend === 'UP' ? 'text-green-700 bg-green-50 border-green-200'
    : recommendation?.trend === 'DOWN' ? 'text-red-700 bg-red-50 border-red-200'
    : 'text-blue-700 bg-blue-50 border-blue-200';

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">←</button>
        <h1>{t('lot.create_title')}</h1>
      </div>

      {error   && <Alert type="error"   message={error}   onClose={() => setError('')} />}
      {success && <Alert type="success" message={success} />}

      {/* Price Intelligence Panel */}
      {(priceData || priceLoading) && (
        <div className="card mb-5 border-brand-200 bg-brand-50">
          <h3 className="text-brand-800 mb-3">📊 Market Price Reference</h3>
          {priceLoading ? (
            <p className="text-sm text-gray-500">Loading price data...</p>
          ) : priceData ? (
            <div className="grid grid-cols-2 gap-4 mb-3">
              {priceData.msp_price && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Govt. MSP</p>
                  <p className="text-2xl font-bold text-brand-700">₹{priceData.msp_price}<span className="text-sm font-normal">/qtl</span></p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Mandi Price Today</p>
                <p className="text-2xl font-bold text-gray-800">₹{priceData.mandi_price?.toFixed(0)}<span className="text-sm font-normal">/qtl</span></p>
              </div>
            </div>
          ) : null}

          {recommendation && (
            <div className={`rounded-lg border px-4 py-3 text-sm font-medium ${trendColor}`}>
              {recommendation.trend === 'UP' && '📈 '}
              {recommendation.trend === 'DOWN' && '📉 '}
              {recommendation.trend === 'STABLE' && '➡️ '}
              {recommendation.recommendation}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">{t('lot.commodity_label')} *</label>
            <input className="input" list="commodities-list" placeholder={t('lot.commodity_placeholder')}
              value={form.commodity} onChange={e => set('commodity', e.target.value)} required />
            <datalist id="commodities-list">{COMMODITIES.map(c => <option key={c} value={c}/>)}</datalist>
          </div>
          <div>
            <label className="label">{t('lot.variety_label')}</label>
            <input className="input" placeholder={t('lot.variety_placeholder')} value={form.variety} onChange={e => set('variety', e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">{t('lot.grade_label')} *</label>
            <select className="input" value={form.grade} onChange={e => set('grade', e.target.value)}>
              {['A', 'B', 'C'].map(g => <option key={g} value={g}>{t(`lot.grades.${g}`)}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('lot.quantity_label')} *</label>
            <input className="input" type="number" min="1" step="0.1" placeholder="e.g. 50" value={form.quantity} onChange={e => set('quantity', e.target.value)} required />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">{t('lot.district_label')} *</label>
            <input className="input" list="districts-list" placeholder="e.g. Pune" value={form.district} onChange={e => set('district', e.target.value)} required />
            <datalist id="districts-list">{DISTRICTS.map(d => <option key={d} value={d}/>)}</datalist>
          </div>
          <div>
            <label className="label">{t('lot.season_label')} *</label>
            <select className="input" value={form.season} onChange={e => set('season', e.target.value)}>
              {['kharif', 'rabi', 'zaid'].map(s => <option key={s} value={s}>{t(`lot.seasons.${s}`)}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">{t('lot.asking_price_label')} *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
              <input className="input pl-7" type="number" min="1" step="0.01" placeholder="2200" value={form.asking_price} onChange={e => set('asking_price', e.target.value)} required />
            </div>
            {priceData?.msp_price && form.asking_price && parseFloat(form.asking_price) < priceData.msp_price && (
              <p className="text-xs text-orange-600 mt-1">⚠️ Asking price is below MSP (₹{priceData.msp_price}/qtl)</p>
            )}
          </div>
          <div>
            <label className="label">{t('lot.harvest_date_label')}</label>
            <input className="input" type="date" value={form.harvest_date} onChange={e => set('harvest_date', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">{t('lot.photo_label')}</label>
          <input className="input" type="url" placeholder="https://..." value={form.photo_url} onChange={e => set('photo_url', e.target.value)} />
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" id="organic" checked={form.organic_flag} onChange={e => set('organic_flag', e.target.checked)} className="w-4 h-4 text-brand-600 rounded" />
          <label htmlFor="organic" className="text-sm font-medium text-gray-700 cursor-pointer">🌿 {t('lot.organic_label')}</label>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">{t('common.cancel')}</button>
          <button type="submit" className="btn-primary flex-1" disabled={loading}>
            {loading ? 'Publishing...' : t('lot.submit_btn')}
          </button>
        </div>
      </form>
    </div>
  );
}
