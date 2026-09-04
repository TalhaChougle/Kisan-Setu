import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { farmers } from '../api/client';
import Alert from '../components/Alert';
import { PageSpinner } from '../components/Spinner';

export default function LotEdit() {
  const { lotId } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [lot, setLot] = useState(null);
  const [form, setForm] = useState({ quantity: '', asking_price: '', grade: 'A', organic_flag: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    farmers.getLot(lotId)
      .then(({ data }) => {
        setLot(data.lot);
        setForm({ quantity: data.lot.quantity, asking_price: data.lot.asking_price, grade: data.lot.grade, organic_flag: data.lot.organic_flag });
      })
      .catch(() => setError(t('common.error')))
      .finally(() => setLoading(false));
  }, [lotId]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await farmers.updateLot(lotId, { ...form, quantity: parseFloat(form.quantity), asking_price: parseFloat(form.asking_price) });
      navigate(`/farmer/lots/${lotId}`);
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    } finally { setSaving(false); }
  }

  if (loading) return <PageSpinner />;
  if (!lot) return <Alert type="error" message="Lot not found." />;

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800">←</button>
        <h1>{t('lot.edit_title')}: {lot.commodity}</h1>
      </div>
      {error && <Alert type="error" message={error} />}
      <form onSubmit={handleSave} className="card space-y-4">
        <div>
          <label className="label">{t('lot.grade_label')}</label>
          <select className="input" value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}>
            {['A','B','C'].map(g => <option key={g} value={g}>{t(`lot.grades.${g}`)}</option>)}
          </select>
        </div>
        <div>
          <label className="label">{t('lot.quantity_label')}</label>
          <input className="input" type="number" min="1" step="0.1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} required />
        </div>
        <div>
          <label className="label">{t('lot.asking_price_label')}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
            <input className="input pl-7" type="number" min="1" step="0.01" value={form.asking_price} onChange={e => setForm(f => ({ ...f, asking_price: e.target.value }))} required />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" id="organic" checked={form.organic_flag} onChange={e => setForm(f => ({ ...f, organic_flag: e.target.checked }))} className="w-4 h-4" />
          <label htmlFor="organic" className="text-sm">🌿 {t('lot.organic_label')}</label>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">{t('common.cancel')}</button>
          <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? 'Saving...' : t('lot.update_btn')}</button>
        </div>
      </form>
    </div>
  );
}
