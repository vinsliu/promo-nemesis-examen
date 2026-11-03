import { useEffect, useState } from 'react';

export function getSession() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(encoded));
    if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now() ||
        typeof claims.userId !== 'string' || !['user', 'admin'].includes(claims.role)) return null;
    return { token, ...claims, username: localStorage.getItem('username') || '' };
  } catch { return null; }
}
export function clearSession() {
  for (const key of ['token', 'username', 'role']) localStorage.removeItem(key);
  window.dispatchEvent(new Event('session-change'));
}
export function useSession() {
  const [session, setSession] = useState(getSession);
  useEffect(() => {
    const update = () => {
      const current = getSession();
      if (!current && localStorage.getItem('token')) clearSession();
      setSession(current);
    };
    window.addEventListener('session-change', update);
    window.addEventListener('storage', update);
    const timer = setInterval(update, 1000);
    return () => { clearInterval(timer); window.removeEventListener('session-change', update); window.removeEventListener('storage', update); };
  }, []);
  return session;
}
