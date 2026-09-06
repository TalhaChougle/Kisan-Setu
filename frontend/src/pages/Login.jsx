import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { auth as authApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [step, setStep]           = useState('mobile');
  const [role, setRole]           = useState('FARMER');
  const [mobile, setMobile]       = useState('');
  const [otp, setOtp]             = useState('');
  const [name, setName]           = useState('');
  const [devOtp, setDevOtp]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError]         = useState('');
  const [info, setInfo]           = useState('');
  const [backendReady, setBackendReady] = useState(false);

  const [adminPwd, setAdminPwd]   = useState('');

  // Pre-warm the backend as soon as the login page loads
  useEffect(() => {
    let cancelled = false;
    async function warmUp() {
      try {
        await fetch(`${import.meta.env.VITE_API_URL?.replace('/api', '') || ''}/health`);
        if (!cancelled) setBackendReady(true);
      } catch {
        // silent — will retry on actual request
      }
    }
    warmUp();
    return () => { cancelled = true; };
  }, []);

  async function sendOtpWithRetry(payload, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        if (i > 0) setLoadingMsg(`Server is waking up... attempt ${i + 1} of ${retries}`);
        const res = await authApi.sendOtp(payload);
        return res;
      } catch (err) {
        const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
        const isNetwork = err.message?.includes('Network Error');
        if ((isTimeout || isNetwork) && i < retries - 1) {
          setLoadingMsg(`Server warming up, retrying... (${i + 2}/${retries})`);
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        throw err;
      }
    }
  }

  async function handleSendOtp(e) {
    e.preventDefault();
    setError(''); setInfo(''); setLoadingMsg('Sending OTP...');
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setLoading(true);
    try {
      if (!backendReady) setLoadingMsg('Waking up server (first request takes ~15s)...');
      const { data } = await sendOtpWithRetry({ mobile, role });
      setDevOtp(data.dev_otp || '');
      setInfo(t('auth.otp_sent', { mobile }));
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reach server. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError(''); setLoadingMsg('Verifying...');
    setLoading(true);
    try {
      const { data } = await authApi.verifyOtp({ mobile, otp, role, name: name || undefined });
      login(data.token, data.user);
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
      setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  }

  async function handleAdminLogin(e) {
    e.preventDefault();
    setError(''); setLoading(true); setLoadingMsg('Logging in...');
    try {
      const { data } = await authApi.adminLogin({ mobile, password: adminPwd });
      login(data.token, data.user);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
      setLoadingMsg('');
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

          {/* OTP banner */}
          {devOtp && (
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4 mb-4 text-center">
              <p className="text-xs text-yellow-700 font-medium uppercase tracking-wide mb-1">Your OTP</p>
              <p className="text-4xl font-bold font-mono text-yellow-800 tracking-widest">{devOtp}</p>
              <p className="text-xs text-yellow-600 mt-1">Enter this code below to login</p>
            </div>
          )}

          {/* Loading state */}
          {loading && loadingMsg && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center gap-3">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-300 border-t-blue-600 flex-shrink-0" />
              <p className="text-sm text-blue-700">{loadingMsg}</p>
            </div>
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
                <label className="label">Mobile</label>
                <input className="input" type="tel" placeholder="9000000000" value={mobile} onChange={e => setMobile(e.target.value)} required />
              </div>
              <div className="mb-2">
                <label className="label">Password</label>
                <input className="input" type="password" placeholder="admin@123" value={adminPwd} onChange={e => setAdminPwd(e.target.value)} required />
              </div>
              <p className="text-xs text-gray-400 mb-4 text-center">Default: mobile 9000000000 / password admin@123</p>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? loadingMsg || 'Logging in...' : 'Login as Admin'}
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
                <p className="text-xs text-gray-400 mt-1">
                  {role === 'FARMER' ? 'Demo: 9111111111' : 'Demo: 9222222221'}
                </p>
              </div>
              <div className="mb-5">
                <label className="label">{t('auth.name_label')} <span className="text-gray-400 font-normal">(new users only)</span></label>
                <input className="input" type="text" placeholder={t('auth.name_placeholder')} value={name} onChange={e => setName(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? (loadingMsg || 'Sending...') : t('auth.send_otp')}
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
                {loading ? (loadingMsg || 'Verifying...') : t('auth.verify_otp')}
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
