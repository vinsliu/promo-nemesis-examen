import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../services/session';
const AdminRoute = ({ children }) => {
  const session = useSession(); const location = useLocation();
  if (!session) return <Navigate to="/login" state={{ returnTo: location.pathname }} replace />;
  return session.role === 'admin' ? children : <Navigate to="/" replace />;
};
export default AdminRoute;
