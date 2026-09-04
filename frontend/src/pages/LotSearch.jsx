import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buyers } from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { PageSpinner } from '../components/Spinner';
import Alert from '../components/Alert';

const COMMODITIES = ['Wheat', 'Onion', 'Soybean', 'Cotton', 'Rice', 'Maize'];
const DISTRICTS   = ['Pune', 'Nashik', 'Aurangabad', 'Ahmednagar', 'Latur', 'Osmanabad', 'Amravati'];
const GRADES      = ['A', 'B', 'C'];

export default function LotSearch() {
  const { t } = useTranslation();
  const { user, isVerifiedBuyer } = useAuth();
  const navigate = useNavigate();

  const [lots,    setLots]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [page,    setPage]    = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    commodity: '', grade: '', district: '', min_price: '', max_price: '',
    min_quantity: '', organic_flag: '', season: '',
  });

  const search = useCallback(async (pg = 1) => {
    setLoading(true);
    const params = { page: pg, limit: 12 };
    Object.entries(filters).forEach(([k, v]) => { if (v !== '') params[k] = v; });
    try {
      const { data } = await buyers.searchLots(params);
      setLots(data.lots || []);
      setTotal(data.total || 0);
      setPage(pg);
    } catch { }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { search(1); }, []);

  function resetFilters() {
    setFilters({ commodity: '', grade: '', district: '', min_price: '', max_price: '', min_quantity: '', organic_flag: '', season: '' });
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 mb-5">
        <h1 className="flex-1">{t('nav.search_lots')}</h1>
        {!isVerifiedBuyer && (
          <Link to="/buyer/verify" className="btn-primary text-sm self-start">Get Verified →</Link>
        )}
      </div>

      {!isVerifiedBuyer && (
        <Alert type="warning" message={`⚠️ ${t('buyer.unverified_notice')}`} />
      )}

      {/* Search bar + filter toggle */}
      <div className="card mb-4">
        <div className="flex gap-3 mb-3">
          <input
            className="input flex-1"
            placeholder={t('buyer.search_placeholder')}
            value={filters.commodity}
            onChange={e => setFilters(f => ({ ...f, commodity: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && search(1)}
          />
          <button onClick={() => search(1)} className="btn-primary px-5">Search</button>
          <button onClick={() => setShowFilters(!showFilters)} className="btn-secondary px-4">
            {t('buyer.filter_btn')} {showFilters ? '▲' : '▼'}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
            <div>
              <label className="label text-xs">Grade</label>
              <select className="input" value={filters.grade} onChange={e => setFilters(f => ({ ...f, grade: e.target.value }))}>
                <option value="">All</option>
                {GRADES.map(g => <option key={g} value={g}>Grade {g}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs">District</label>
              <select className="input" value={filters.district} onChange={e => setFilters(f => ({ ...f, district: e.target.value }))}>
                <option value="">All</option>
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs">Min Price (₹/qtl)</label>
              <input className="input" type="number" placeholder="e.g. 1500" value={filters.min_price} onChange={e => setFilters(f => ({ ...f, min_price: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs">Max Price (₹/qtl)</label>
              <input className="input" type="number" placeholder="e.g. 5000" value={filters.max_price} onChange={e => setFilters(f => ({ ...f, max_price: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs">Min Quantity (qtl)</label>
              <input className="input" type="number" placeholder="e.g. 10" value={filters.min_quantity} onChange={e => setFilters(f => ({ ...f, min_quantity: e.target.value }))} />
            </div>
            <div>
              <label className="label text-xs">Season</label>
              <select className="input" value={filters.season} onChange={e => setFilters(f => ({ ...f, season: e.target.value }))}>
                <option value="">All</option>
                <option value="kharif">Kharif</option>
                <option value="rabi">Rabi</option>
                <option value="zaid">Zaid</option>
              </select>
            </div>
            <div>
              <label className="label text-xs">Organic</label>
              <select className="input" value={filters.organic_flag} onChange={e => setFilters(f => ({ ...f, organic_flag: e.target.value }))}>
                <option value="">Any</option>
                <option value="true">Organic only</option>
                <option value="false">Non-organic</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button onClick={() => search(1)} className="btn-primary flex-1 text-sm">Apply</button>
              <button onClick={() => { resetFilters(); }} className="btn-secondary text-sm px-3">Reset</button>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      <p className="text-sm text-gray-500 mb-3">{total} lots found</p>

      {loading ? <PageSpinner /> : lots.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-4xl mb-2">🔍</p>
          <p className="text-gray-500">No lots match your search. Try adjusting filters.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lots.map(lot => (
            <div key={lot.lot_id} className="card hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/buyer/lots/${lot.lot_id}`)}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold">{lot.commodity} {lot.variety && `(${lot.variety})`}</p>
                  <p className="text-sm text-gray-500">{lot.farmer?.district || lot.district} · Grade {lot.grade}</p>
                </div>
                {lot.organic_flag && <span className="text-green-600 text-xs font-medium">🌿 Organic</span>}
              </div>
              <div className="text-2xl font-bold text-brand-700 mb-1">₹{lot.asking_price}<span className="text-sm font-normal text-gray-500">/qtl</span></div>
              <div className="flex justify-between text-sm text-gray-600 mb-3">
                <span>📦 {lot.quantity} qtl</span>
                <span className="capitalize">🗓 {lot.season}</span>
              </div>
              {lot.msp_at_listing && (
                <p className="text-xs text-blue-600">Govt. MSP: ₹{lot.msp_at_listing}/qtl</p>
              )}
              {isVerifiedBuyer ? (
                <button className="btn-primary w-full mt-3 text-sm" onClick={e => { e.stopPropagation(); navigate(`/buyer/lots/${lot.lot_id}`); }}>
                  Make Offer
                </button>
              ) : (
                <p className="text-xs text-gray-400 mt-3 text-center">Verify to make offers</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 12 && (
        <div className="flex justify-center gap-3 mt-6">
          <button disabled={page === 1} onClick={() => search(page - 1)} className="btn-secondary text-sm">← Prev</button>
          <span className="py-2 text-sm text-gray-600">Page {page} of {Math.ceil(total / 12)}</span>
          <button disabled={page * 12 >= total} onClick={() => search(page + 1)} className="btn-secondary text-sm">Next →</button>
        </div>
      )}
    </div>
  );
}
