import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { PageSpinner } from './components/Spinner';

// ── Lazy-loaded pages ──────────────────────────────────────────────────────
const Login           = lazy(() => import('./pages/Login'));
const KycPage         = lazy(() => import('./pages/KycPage'));
const BusinessProof   = lazy(() => import('./pages/BusinessProof'));

const FarmerDashboard = lazy(() => import('./pages/FarmerDashboard'));
const LotCreate       = lazy(() => import('./pages/LotCreate'));
const LotEdit         = lazy(() => import('./pages/LotEdit'));
const FarmerLots      = lazy(() => import('./pages/FarmerLots'));
const FarmerLotDetail = lazy(() => import('./pages/FarmerLotDetail'));
const FarmerDeals     = lazy(() => import('./pages/FarmerDeals'));

const BuyerDashboard  = lazy(() => import('./pages/BuyerDashboard'));
const LotSearch       = lazy(() => import('./pages/LotSearch'));
const LotDetail       = lazy(() => import('./pages/LotDetail'));
const BuyerOffers     = lazy(() => import('./pages/BuyerOffers'));
const BuyerDeals      = lazy(() => import('./pages/BuyerDeals'));

const Negotiation     = lazy(() => import('./pages/Negotiation'));
const DealHandoff     = lazy(() => import('./pages/DealHandoff'));
const DisputeFlow     = lazy(() => import('./pages/DisputeFlow'));
const DisputeDetail   = lazy(() => import('./pages/DisputeDetail'));
const PriceChart      = lazy(() => import('./pages/PriceChart'));

const AdminDashboard  = lazy(() => import('./pages/AdminDashboard'));
const AdminDisputes   = lazy(() => import('./pages/AdminDisputes'));
const AdminAudit      = lazy(() => import('./pages/AdminAudit'));

// ── Guards ─────────────────────────────────────────────────────────────────
function RequireAuth({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <PageSpinner />;
  if (!user)   return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function RoleRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <PageSpinner />;
  if (!user)   return <Navigate to="/login" replace />;
  if (user.role === 'FARMER') return <Navigate to="/farmer/dashboard" replace />;
  if (user.role === 'BUYER')  return <Navigate to="/buyer/dashboard"  replace />;
  if (user.role === 'ADMIN')  return <Navigate to="/admin/dashboard"  replace />;
  return <Navigate to="/login" replace />;
}

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />

            {/* Root redirect */}
            <Route path="/" element={<RoleRedirect />} />

            {/* Shared — auth required but any role */}
            <Route path="/kyc" element={
              <RequireAuth><Layout><KycPage /></Layout></RequireAuth>
            }/>
            <Route path="/prices" element={
              <RequireAuth><Layout><PriceChart /></Layout></RequireAuth>
            }/>
            <Route path="/disputes" element={
              <RequireAuth><Layout><DisputeFlow /></Layout></RequireAuth>
            }/>
            <Route path="/disputes/:id" element={
              <RequireAuth><Layout><DisputeDetail /></Layout></RequireAuth>
            }/>

            {/* Farmer */}
            <Route path="/farmer/dashboard" element={
              <RequireAuth role="FARMER"><Layout><FarmerDashboard /></Layout></RequireAuth>
            }/>
            <Route path="/farmer/lots" element={
              <RequireAuth role="FARMER"><Layout><FarmerLots /></Layout></RequireAuth>
            }/>
            <Route path="/farmer/lots/create" element={
              <RequireAuth role="FARMER"><Layout><LotCreate /></Layout></RequireAuth>
            }/>
            <Route path="/farmer/lots/:lotId/edit" element={
              <RequireAuth role="FARMER"><Layout><LotEdit /></Layout></RequireAuth>
            }/>
            <Route path="/farmer/lots/:lotId" element={
              <RequireAuth role="FARMER"><Layout><FarmerLotDetail /></Layout></RequireAuth>
            }/>
            <Route path="/farmer/lots/:lotId/offers/:offerId/negotiate" element={
              <RequireAuth role="FARMER"><Layout><Negotiation /></Layout></RequireAuth>
            }/>
            <Route path="/farmer/deals" element={
              <RequireAuth role="FARMER"><Layout><FarmerDeals /></Layout></RequireAuth>
            }/>
            <Route path="/farmer/deals/:dealId" element={
              <RequireAuth role="FARMER"><Layout><DealHandoff /></Layout></RequireAuth>
            }/>

            {/* Buyer */}
            <Route path="/buyer/dashboard" element={
              <RequireAuth role="BUYER"><Layout><BuyerDashboard /></Layout></RequireAuth>
            }/>
            <Route path="/buyer/kyc"    element={
              <RequireAuth role="BUYER"><Layout><KycPage /></Layout></RequireAuth>
            }/>
            <Route path="/buyer/verify" element={
              <RequireAuth role="BUYER"><Layout><BusinessProof /></Layout></RequireAuth>
            }/>
            <Route path="/buyer/search" element={
              <RequireAuth role="BUYER"><Layout><LotSearch /></Layout></RequireAuth>
            }/>
            <Route path="/buyer/lots/:lotId" element={
              <RequireAuth role="BUYER"><Layout><LotDetail /></Layout></RequireAuth>
            }/>
            <Route path="/buyer/offers" element={
              <RequireAuth role="BUYER"><Layout><BuyerOffers /></Layout></RequireAuth>
            }/>
            <Route path="/buyer/deals" element={
              <RequireAuth role="BUYER"><Layout><BuyerDeals /></Layout></RequireAuth>
            }/>
            <Route path="/buyer/deals/:dealId" element={
              <RequireAuth role="BUYER"><Layout><DealHandoff /></Layout></RequireAuth>
            }/>

            {/* Admin */}
            <Route path="/admin/dashboard" element={
              <RequireAuth role="ADMIN"><Layout><AdminDashboard /></Layout></RequireAuth>
            }/>
            <Route path="/admin/disputes" element={
              <RequireAuth role="ADMIN"><Layout><AdminDisputes /></Layout></RequireAuth>
            }/>
            <Route path="/admin/audit" element={
              <RequireAuth role="ADMIN"><Layout><AdminAudit /></Layout></RequireAuth>
            }/>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
