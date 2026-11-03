// Persist digests and random keys only, never shipping addresses.
const storageKey = 'checkout-attempt-v2';
let memory = {};
let currentKey;
export async function getOrderAttempt(payload, userId) {
  const canonical = JSON.stringify({ userId, shippingAddress: payload.shippingAddress,
    paymentMethod: payload.paymentMethod, shippingMethod: payload.shippingMethod,
    items: [...payload.items].map(({ productId, quantity }) => ({ productId, quantity }))
      .sort((a, b) => a.productId.localeCompare(b.productId)) });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  let attempts = memory;
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey));
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) attempts = saved;
  } catch { /* Memory fallback. */ }
  attempts = Object.fromEntries(Object.entries(attempts).filter(([digest, key]) => /^[a-f\d]{64}$/.test(digest) && /^[a-f\d]{32}$/.test(key)));
  if (!attempts[fingerprint]) {
    // Never evict an ambiguous attempt and risk recreating an already accepted order.
    if (Object.keys(attempts).length >= 20) throw new Error('Trop de tentatives non confirmées. Contactez un administrateur.');
    attempts[fingerprint] = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  memory = attempts; currentKey = attempts[fingerprint];
  try { sessionStorage.setItem(storageKey, JSON.stringify(memory)); } catch { /* Memory fallback. */ }
  return currentKey;
}
export function clearOrderAttempt(key = currentKey) {
  let attempts = memory;
  try { attempts = JSON.parse(sessionStorage.getItem(storageKey)) || attempts; } catch { /* Memory fallback. */ }
  memory = Object.fromEntries(Object.entries(attempts).filter(([, value]) => value !== key));
  try { sessionStorage.setItem(storageKey, JSON.stringify(memory)); } catch { /* Memory fallback. */ }
}
