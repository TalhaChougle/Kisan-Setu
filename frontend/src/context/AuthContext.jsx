import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth as authApi } from '../api/client';
import i18n from '../i18n/i18n';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('kisansetu_user');
    const token  = localStorage.getItem('kisansetu_token');
    if (stored && token) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        if (parsed.language_pref) i18n.changeLanguage(parsed.language_pref);
      } catch {}
    }
    setLoading(false);
  }, []);

  const login = useCallback((token, userData) => {
    localStorage.setItem('kisansetu_token', token);
    localStorage.setItem('kisansetu_user', JSON.stringify(userData));
    if (userData.language_pref) {
      i18n.changeLanguage(userData.language_pref);
      localStorage.setItem('kisansetu_lang', userData.language_pref);
    }
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('kisansetu_token');
    localStorage.removeItem('kisansetu_user');
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await authApi.me();
      if (data.success) {
        setUser(data.user);
        localStorage.setItem('kisansetu_user', JSON.stringify(data.user));
      }
    } catch {}
  }, []);

  const updateUserLocally = useCallback((updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates };
      localStorage.setItem('kisansetu_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const value = {
    user,
    loading,
    login,
    logout,
    refreshUser,
    updateUserLocally,
    isAuthenticated: !!user,
    isFarmer: user?.role === 'FARMER',
    isBuyer:  user?.role === 'BUYER',
    isAdmin:  user?.role === 'ADMIN',
    isVerifiedBuyer: user?.role === 'BUYER' && user?.verification_status === 'VERIFIED',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
