import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buyers } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';

const PROOF_TYPES = ['GST_CERTIFICATE', 'MANDI_LICENCE', 'EXPORT_LICENCE', 'FPO_REGISTRATION'];

export default function BusinessProof() {
  const { t } = useTranslation();
  const { user, updateUserLocally } = useAuth();
  const navigate = useNavigate();

  const [proofType, setProofType] = useState('GST_CERTIFICATE');
  const [proofUrl, setProofUrl]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');

  if (user?.verification_status === 'VERIFIED') {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card text-center py-10">
          <div className="text-5xl mb-4">🏅</div>
          <h2 className="text-brand-700 mb-2">{t('business_proof.success')}</h2>
          <p className="text-gray-600 mb-6">You can now browse lots and make offers.</p>
          <button onClick={() => navigate('/buyer/dashboard')} className="btn-primary">{t('nav.dashboard')}</button>
        </div>
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await buyers.submitProof({ business_proof_type: proofType, business_proof_url: proofUrl });
      setSuccess(t('business_proof.success'));
      updateUserLocally({ verification_status: 'VERIFIED' });
      setTimeout(() => navigate('/buyer/dashboard'), 1800);
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="card">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">📋</div>
          <h1>{t('business_proof.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('business_proof.subtitle')}</p>
        </div>

        {error   && <Alert type="error"   message={error}   onClose={() => setError('')} />}
        {success && <Alert type="success" message={success} />}

        {!user?.aadhaar_verified && (
          <Alert type="warning" message="Please complete Aadhaar e-KYC first before uploading business proof." />
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="label">{t('business_proof.type_label')}</label>
            <select className="input" value={proofType} onChange={e => setProofType(e.target.value)}>
              {PROOF_TYPES.map(pt => (
                <option key={pt} value={pt}>{t(`business_proof.types.${pt}`)}</option>
              ))}
            </select>
          </div>
          <div className="mb-5">
            <label className="label">{t('business_proof.url_label')}</label>
            <input
              className="input"
              type="url"
              placeholder={t('business_proof.url_placeholder')}
              value={proofUrl}
              onChange={e => setProofUrl(e.target.value)}
              required
            />
            <p className="text-xs text-gray-500 mt-1">For demo: enter any valid URL, e.g. https://example.com/proof.pdf</p>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading || !user?.aadhaar_verified}>
            {loading ? t('business_proof.submitting') : t('business_proof.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
