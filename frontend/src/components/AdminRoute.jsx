import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../services/session';
/**
 * Route réservée aux administrateurs : redirige vers /login sans session (en mémorisant la page demandée)
 * et vers l'accueil pour un simple utilisateur. Confort d'affichage uniquement : le serveur revérifie
 * toujours le rôle sur chaque appel d'API.
 * @param {{children: React.ReactNode}} props
 */
const AdminRoute = ({ children }) => {
  const session = useSession(); const location = useLocation();
  if (!session) return <Navigate to="/login" state={{ returnTo: location.pathname }} replace />;
  return session.role === 'admin' ? children : <Navigate to="/" replace />;
};
export default AdminRoute;
