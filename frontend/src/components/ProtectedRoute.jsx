import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../services/session';
const ProtectedRoute = ({ children }) => {
  const session = useSession();
  const location = useLocation();
  return session ? children : <Navigate to="/login" state={{ returnTo: location.pathname }} replace />;
};
export default ProtectedRoute;
