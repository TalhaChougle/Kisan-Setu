import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
  baseURL: API_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('kisansetu_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle auth errors globally + auto-retry on network errors
client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config;
    if (err.response?.status === 401) {
      localStorage.removeItem('kisansetu_token');
      localStorage.removeItem('kisansetu_user');
      window.location.href = '/login';
      return Promise.reject(err);
    }
    // Auto-retry once on timeout or network error (backend cold start)
    if (!config._retried && (err.code === 'ECONNABORTED' || !err.response)) {
      config._retried = true;
      await new Promise(r => setTimeout(r, 4000));
      return client(config);
    }
    return Promise.reject(err);
  }
);

export default client;

// ── Auth ──────────────────────────────────────────────────────────────────
export const auth = {
  sendOtp:    (data) => client.post('/auth/send-otp', data),
  verifyOtp:  (data) => client.post('/auth/verify-otp', data),
  adminLogin: (data) => client.post('/auth/admin-login', data),
  me:         ()     => client.get('/auth/me'),
};

// ── Farmer ────────────────────────────────────────────────────────────────
export const farmers = {
  getProfile:    ()        => client.get('/farmers/profile'),
  updateProfile: (data)    => client.put('/farmers/profile', data),
  kyc:           (data)    => client.post('/farmers/kyc', data),
  getLots:       (params)  => client.get('/farmers/lots', { params }),
  getLot:        (id)      => client.get(`/farmers/lots/${id}`),
  createLot:     (data)    => client.post('/farmers/lots', data),
  updateLot:     (id, data)=> client.put(`/farmers/lots/${id}`, data),
  withdrawLot:   (id)      => client.delete(`/farmers/lots/${id}`),
  getNotifications: ()     => client.get('/farmers/notifications'),
};

// ── Buyer ─────────────────────────────────────────────────────────────────
export const buyers = {
  getProfile:      ()        => client.get('/buyers/profile'),
  updateProfile:   (data)    => client.put('/buyers/profile', data),
  kyc:             (data)    => client.post('/buyers/kyc', data),
  submitProof:     (data)    => client.post('/buyers/business-proof', data),
  searchLots:      (params)  => client.get('/buyers/lots/search', { params }),
  getLot:          (id)      => client.get(`/buyers/lots/${id}`),
  makeOffer:       (lotId, data) => client.post(`/buyers/lots/${lotId}/offers`, data),
  getOffers:       ()        => client.get('/buyers/offers'),
  getDeals:        ()        => client.get('/buyers/deals'),
  getNotifications:()        => client.get('/buyers/notifications'),
};

// ── Lots (public + farmer offer management) ───────────────────────────────
export const lots = {
  list:         (params)           => client.get('/lots', { params }),
  get:          (id)               => client.get(`/lots/${id}`),
  getOffers:    (lotId)            => client.get(`/lots/${lotId}/offers`),
  acceptOffer:  (lotId, offerId)   => client.patch(`/lots/${lotId}/offers/${offerId}/accept`),
  rejectOffer:  (lotId, offerId)   => client.patch(`/lots/${lotId}/offers/${offerId}/reject`),
  counterOffer: (lotId, offerId, data) => client.patch(`/lots/${lotId}/offers/${offerId}/counter`, data),
  getLogistics: (lotId)            => client.get(`/lots/${lotId}/logistics`),
};

// ── Deals ─────────────────────────────────────────────────────────────────
export const deals = {
  get:            (id)    => client.get(`/deals/${id}`),
  getToken:       (id)    => client.get(`/deals/${id}/token`),
  confirmHandoff: (id, data) => client.post(`/deals/${id}/confirm-handoff`, data),
};

// ── Disputes ──────────────────────────────────────────────────────────────
export const disputes = {
  raise:   (data)               => client.post('/disputes', data),
  get:     (id)                 => client.get(`/disputes/${id}`),
  list:    ()                   => client.get('/disputes'),
  resolve: (id, data)           => client.patch(`/disputes/${id}/resolve`, data),
};

// ── Prices ────────────────────────────────────────────────────────────────
export const prices = {
  commodities:    ()       => client.get('/price/commodities'),
  regions:        ()       => client.get('/price/regions'),
  latest:         (params) => client.get('/price/latest', { params }),
  trend:          (params) => client.get('/price/trend', { params }),
  recommendation: (params) => client.get('/price/recommendation', { params }),
  summary:        ()       => client.get('/price/summary'),
};

// ── Admin ─────────────────────────────────────────────────────────────────
export const admin = {
  dashboard:         ()        => client.get('/admin/dashboard'),
  transactions:      (params)  => client.get('/admin/transactions', { params }),
  disputes:          (params)  => client.get('/admin/disputes', { params }),
  farmers:           (params)  => client.get('/admin/farmers', { params }),
  buyers:            (params)  => client.get('/admin/buyers', { params }),
  verifyBuyer:       (id, data)=> client.patch(`/admin/buyers/${id}/verify`, data),
  deals:             (params)  => client.get('/admin/deals', { params }),
  flaggedDeals:      ()        => client.get('/admin/deals/flagged'),
  fraudFlags:        ()        => client.get('/admin/fraud-flags'),
  auditLog:          (params)  => client.get('/admin/audit-log', { params }),
  regionalPrices:    (params)  => client.get('/admin/regional-prices', { params }),
};
