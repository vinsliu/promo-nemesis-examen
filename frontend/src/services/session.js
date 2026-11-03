import { useEffect, useState } from 'react';

// Le jeton d'authentification vit dans un cookie HttpOnly (inaccessible au JavaScript).
// Seules des informations d'affichage non sensibles sont gardées ici ; le serveur reste l'autorité.
const SESSION_KEY = 'session';

export function saveSession({ userId, role, username, expiresAt }) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, role, username, expiresAt })); } catch { /* Stockage indisponible. */ }
  window.dispatchEvent(new Event('session-change'));
}
export function getSession() {
  try {
    const claims = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (!claims || !Number.isFinite(claims.expiresAt) || claims.expiresAt <= Date.now() ||
        typeof claims.userId !== 'string' || typeof claims.username !== 'string' ||
        !['user', 'admin'].includes(claims.role)) return null;
    return claims;
  } catch { return null; }
}
export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* Stockage indisponible. */ }
  window.dispatchEvent(new Event('session-change'));
}
export function useSession() {
  const [session, setSession] = useState(getSession);
  useEffect(() => {
    const update = () => {
      const current = getSession();
      if (!current && localStorage.getItem(SESSION_KEY)) clearSession();
      setSession(current);
    };
    window.addEventListener('session-change', update);
    window.addEventListener('storage', update);
    const timer = setInterval(update, 1000);
    return () => { clearInterval(timer); window.removeEventListener('session-change', update); window.removeEventListener('storage', update); };
  }, []);
  return session;
}
