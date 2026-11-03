import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../services/session';
/**
 * Route réservée aux utilisateurs connectés ; sinon redirige vers /login et conserve la page demandée
 * dans `state.returnTo` pour y revenir après la connexion.
 * @param {{children: React.ReactNode}} props
 */
const ProtectedRoute = ({ children }) => {
  const session = useSession();
  const location = useLocation();
  return session ? children : <Navigate to="/login" state={{ returnTo: location.pathname }} replace />;
};
export default ProtectedRoute;
