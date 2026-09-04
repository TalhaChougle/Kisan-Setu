import React from 'react';
import { useNavigate } from 'react-router-dom';

// Negotiation detail is handled inline in FarmerLotDetail and LotDetail
// This page serves as a redirect shim
export default function Negotiation() {
  const navigate = useNavigate();
  React.useEffect(() => { navigate(-1); }, []);
  return null;
}
