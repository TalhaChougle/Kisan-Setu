import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { auth as authApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [step, setStep]       = useState('mobile');   // mobile | otp
  const [role, setRole]       = useState('FARMER');
  const [mobile, setMobile]   = useState('');
  const [otp, setOtp]         = useState('');
  const [name, setName]       = useState('');
  const [devOtp, setDevOtp]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [info, setInfo]       = useState('');

  // Admin uses password login
  const [adminPwd, setAdminPwd] = useState('');

  async function handleSendOtp(e) {
    e.preventDefault();
    setError(''); setInfo('');
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await authApi.sendOtp({ mobile, role });
      setDevOtp(data.dev_otp || '');
      setInfo(t('auth.otp_sent', { mobile }));
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.verifyOtp({ mobile, otp, role, name: name || undefined });
      login(data.token, data.user);

      // Route based on onboarding state
      if (data.user.role === 'FARMER') {
        if (!data.user.aadhaar_verified) return navigate('/kyc');
        return navigate('/farmer/dashboard');
      }
      if (data.user.role === 'BUYER') {
        if (!data.user.aadhaar_verified) return navigate('/buyer/kyc');
        if (data.user.verification_status !== 'VERIFIED') return navigate('/buyer/verify');
        return navigate('/buyer/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.adminLogin({ mobile, password: adminPwd });
      login(data.token, data.user);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-700 to-brand-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🌾</div>
          <h1 className="text-3xl font-bold text-white">KisanSetu</h1>
          <p className="text-green-200 text-sm mt-1">{t('tagline')}</p>
          <p className="text-green-300 text-xs mt-1">{t('govt_label')}</p>
        </div>

        <div className="card">
          <h2 className="text-center mb-6">{t('auth.login_title')}</h2>

          {error && <Alert type="error" message={error} onClose={() => setError('')} />}
          {info  && <Alert type="info"  message={info}  onClose={() => setInfo('')}  />}
          {devOtp && (
            <Alert type="warning" message={`🔧 ${t('auth.dev_otp_hint', { otp: devOtp })}`} />
          )}

          {/* Role selector */}
          <div className="mb-5">
            <label className="label">{t('auth.role_label')}</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: 'FARMER', label: t('auth.role_farmer'),  icon: '👨‍🌾' },
                { val: 'BUYER',  label: t('auth.role_buyer'),   icon: '🏢' },
                { val: 'ADMIN',  label: t('auth.role_admin'),   icon: '🏛️' },
              ].map(r => (
                <button
                  key={r.val}
                  type="button"
                  onClick={() => { setRole(r.val); setStep('mobile'); setError(''); setDevOtp(''); }}
                  className={`py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                    role === r.val
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 text-gray-600 hover:border-brand-300'
                  }`}
                >
                  <div className="text-xl mb-1">{r.icon}</div>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Admin login */}
          {role === 'ADMIN' ? (
            <form onSubmit={handleAdminLogin}>
              <div className="mb-4">
                <label className="label">{t('auth.mobile_label')}</label>
                <input className="input" type="tel" placeholder="Admin mobile" value={mobile} onChange={e => setMobile(e.target.value)} required />
              </div>
              <div className="mb-5">
                <label className="label">Password</label>
                <input className="input" type="password" placeholder="Admin password" value={adminPwd} onChange={e => setAdminPwd(e.target.value)} required />
                <p className="text-xs text-gray-500 mt-1">Default: admin@123 (mobile: 9000000000)</p>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? t('auth.verifying') : 'Login as Admin'}
              </button>
            </form>
          ) : step === 'mobile' ? (
            <form onSubmit={handleSendOtp}>
              <div className="mb-4">
                <label className="label">{t('auth.mobile_label')}</label>
                <div className="flex">
                  <span className="flex items-center px-3 border border-r-0 border-gray-300 bg-gray-50 rounded-l-lg text-gray-600 text-sm">+91</span>
                  <input
                    className="input rounded-l-none"
                    type="tel"
                    maxLength={10}
                    placeholder={t('auth.mobile_placeholder')}
                    value={mobile}
                    onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
              </div>
              {!mobile.match(/^[6-9]\d{9}$/) && role === 'FARMER' && (
                <p className="text-xs text-gray-500 mb-3">Try: 9111111111 (seeded farmer)</p>
              )}
              {!mobile.match(/^[6-9]\d{9}$/) && role === 'BUYER' && (
                <p className="text-xs text-gray-500 mb-3">Try: 9222222221 (seeded buyer)</p>
              )}
              <div className="mb-5">
                <label className="label">{t('auth.name_label')} <span className="text-gray-400 font-normal">(optional for new users)</span></label>
                <input className="input" type="text" placeholder={t('auth.name_placeholder')} value={name} onChange={e => setName(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? t('auth.sending') : t('auth.send_otp')}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              <p className="text-sm text-gray-600 mb-4">{t('auth.otp_sent', { mobile: `+91 ${mobile}` })}</p>
              <div className="mb-5">
                <label className="label">{t('auth.otp_label')}</label>
                <input
                  className="input text-center text-2xl tracking-widest font-mono"
                  type="text"
                  maxLength={6}
                  placeholder="______"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  required
                  autoFocus
                />
              </div>
              <button type="submit" className="btn-primary w-full mb-3" disabled={loading || otp.length < 6}>
                {loading ? t('auth.verifying') : t('auth.verify_otp')}
              </button>
              <button type="button" className="btn-secondary w-full text-sm" onClick={() => { setStep('mobile'); setOtp(''); setDevOtp(''); }}>
                ← Change Mobile
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
