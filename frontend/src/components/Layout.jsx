import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import i18n from '../i18n/i18n';

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हि' },
  { code: 'mr', label: 'म' },
];

function NavLink({ to, children, onClick }) {
  const location = useLocation();
  const active = location.pathname === to || location.pathname.startsWith(to + '/');
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active
          ? 'bg-brand-700 text-white'
          : 'text-green-100 hover:bg-brand-700 hover:text-white'
      }`}
    >
      {children}
    </Link>
  );
}

export default function Layout({ children }) {
  const { t } = useTranslation();
  const { user, logout, isFarmer, isBuyer, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const changeLang = (code) => {
    i18n.changeLanguage(code);
    localStorage.setItem('kisansetu_lang', code);
    setMenuOpen(false);
  };

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <nav className="bg-brand-700 text-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 font-bold text-lg">
              <span className="text-2xl">🌾</span>
              <span>{t('app_name')}</span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1">
              {isFarmer && (
                <>
                  <NavLink to="/farmer/dashboard">{t('nav.dashboard')}</NavLink>
                  <NavLink to="/farmer/lots">{t('nav.my_lots')}</NavLink>
                  <NavLink to="/farmer/lots/create">{t('nav.create_lot')}</NavLink>
                  <NavLink to="/farmer/deals">{t('nav.my_deals')}</NavLink>
                  <NavLink to="/disputes">{t('nav.disputes')}</NavLink>
                  <NavLink to="/prices">{t('nav.prices')}</NavLink>
                </>
              )}
              {isBuyer && (
                <>
                  <NavLink to="/buyer/dashboard">{t('nav.dashboard')}</NavLink>
                  <NavLink to="/buyer/search">{t('nav.search_lots')}</NavLink>
                  <NavLink to="/buyer/offers">{t('nav.my_offers')}</NavLink>
                  <NavLink to="/buyer/deals">{t('nav.my_deals')}</NavLink>
                  <NavLink to="/disputes">{t('nav.disputes')}</NavLink>
                  <NavLink to="/prices">{t('nav.prices')}</NavLink>
                </>
              )}
              {isAdmin && (
                <>
                  <NavLink to="/admin/dashboard">{t('nav.admin')}</NavLink>
                  <NavLink to="/admin/disputes">{t('nav.disputes')}</NavLink>
                  <NavLink to="/admin/audit">{t('admin.view_audit')}</NavLink>
                </>
              )}
            </div>

            {/* Right: language + user */}
            <div className="flex items-center gap-3">
              {/* Language switcher */}
              <div className="flex gap-1">
                {LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    onClick={() => changeLang(l.code)}
                    className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                      i18n.language === l.code ? 'bg-white text-brand-700' : 'text-green-100 hover:bg-brand-600'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>

              {user && (
                <div className="hidden md:flex items-center gap-2">
                  <span className="text-green-200 text-sm">{user.name?.split(' ')[0]}</span>
                  <button onClick={handleLogout} className="text-green-100 hover:text-white text-sm font-medium">{t('nav.logout')}</button>
                </div>
              )}

              {/* Mobile menu toggle */}
              <button
                className="md:hidden text-white"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Toggle menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {menuOpen
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  }
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden px-4 pb-3 space-y-1 border-t border-brand-600">
            {isFarmer && (
              <>
                <NavLink to="/farmer/dashboard" onClick={closeMenu}>{t('nav.dashboard')}</NavLink>
                <NavLink to="/farmer/lots" onClick={closeMenu}>{t('nav.my_lots')}</NavLink>
                <NavLink to="/farmer/lots/create" onClick={closeMenu}>{t('nav.create_lot')}</NavLink>
                <NavLink to="/farmer/deals" onClick={closeMenu}>{t('nav.my_deals')}</NavLink>
                <NavLink to="/disputes" onClick={closeMenu}>{t('nav.disputes')}</NavLink>
                <NavLink to="/prices" onClick={closeMenu}>{t('nav.prices')}</NavLink>
              </>
            )}
            {isBuyer && (
              <>
                <NavLink to="/buyer/dashboard" onClick={closeMenu}>{t('nav.dashboard')}</NavLink>
                <NavLink to="/buyer/search" onClick={closeMenu}>{t('nav.search_lots')}</NavLink>
                <NavLink to="/buyer/offers" onClick={closeMenu}>{t('nav.my_offers')}</NavLink>
                <NavLink to="/buyer/deals" onClick={closeMenu}>{t('nav.my_deals')}</NavLink>
                <NavLink to="/disputes" onClick={closeMenu}>{t('nav.disputes')}</NavLink>
                <NavLink to="/prices" onClick={closeMenu}>{t('nav.prices')}</NavLink>
              </>
            )}
            {isAdmin && (
              <>
                <NavLink to="/admin/dashboard" onClick={closeMenu}>{t('nav.admin')}</NavLink>
                <NavLink to="/admin/disputes" onClick={closeMenu}>{t('nav.disputes')}</NavLink>
              </>
            )}
            {user && (
              <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm text-green-100 hover:text-white">
                {t('nav.logout')}
              </button>
            )}
          </div>
        )}
      </nav>

      {/* Govt banner */}
      <div className="bg-saffron-500 text-white text-center text-xs py-1 font-medium tracking-wide">
        🏛️ {t('govt_label')} — Smart India Hackathon 2026
      </div>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-400 text-center text-xs py-3">
        © 2026 KisanSetu — Government of Maharashtra | Problem Statement ID: 26132
      </footer>
    </div>
  );
}
