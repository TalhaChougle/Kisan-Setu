import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { farmers, buyers } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';

export default function KycPage() {
  const { t } = useTranslation();
  const { user, updateUserLocally, isFarmer, isBuyer } = useAuth();
  const navigate = useNavigate();

  const [aadhaar, setAadhaar] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  const api = isFarmer ? farmers : buyers;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!/^\d{12}$/.test(aadhaar)) {
      setError('Aadhaar must be exactly 12 digits.');
      return;
    }
    setLoading(true); setError('');
    try {
      const { data } = await api.kyc({ aadhaar_number: aadhaar });
      setSuccess(data.message);
      updateUserLocally({ aadhaar_verified: true });

      setTimeout(() => {
        if (isFarmer) navigate('/farmer/dashboard');
        else if (user?.verification_status !== 'VERIFIED') navigate('/buyer/verify');
        else navigate('/buyer/dashboard');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  if (user?.aadhaar_verified) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card text-center py-10">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-brand-700 mb-2">{t('kyc.already_verified')}</h2>
          <p className="text-gray-600 mb-6">Your Aadhaar identity has been verified.</p>
          <button onClick={() => navigate(-1)} className="btn-primary">{t('common.back')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="card">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🪪</div>
          <h1>{t('kyc.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('kyc.subtitle')}</p>
        </div>

        {error   && <Alert type="error"   message={error}   onClose={() => setError('')} />}
        {success && <Alert type="success" message={success} />}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5 text-sm text-blue-800">
          🔒 <strong>Privacy Notice:</strong> Your Aadhaar number is sent to the verification service and immediately discarded. Only a boolean "verified" flag is stored.
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="label">{t('kyc.aadhaar_label')}</label>
            <input
              className="input text-center text-lg tracking-widest font-mono"
              type="text"
              maxLength={12}
              placeholder={t('kyc.aadhaar_placeholder')}
              value={aadhaar}
              onChange={e => setAadhaar(e.target.value.replace(/\D/g, ''))}
              required
            />
            <p className="text-xs text-gray-500 mt-1">Test: any 12-digit number (e.g. 123456789012). Numbers ending in 0000 will fail.</p>
          </div>
          <button type="submit" className="btn-primary w-full mb-3" disabled={loading || aadhaar.length < 12}>
            {loading ? t('kyc.verifying') : t('kyc.verify_btn')}
          </button>
          <button type="button" className="btn-secondary w-full" onClick={() => navigate(-1)}>
            {t('kyc.skip')}
          </button>
        </form>
      </div>
    </div>
  );
}
