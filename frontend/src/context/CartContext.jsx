/**
 * @module context/CartContext
 */
import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { defaultShippingMethod, defaultPaymentMethod } from '../services/checkoutOptions';
const CartContext = createContext();
const STORAGE_KEY = 'cart-v1';
const initialState = { cart: [], shippingMethod: defaultShippingMethod, paymentMethod: defaultPaymentMethod,
  shippingAddress: { street: '', city: '', postalCode: '', country: '' } };
function restore() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data?.version !== 1 || !Array.isArray(data.cart) || data.cart.length > 100) return initialState;
    const ids = new Set();
    const cart = data.cart.filter(item => {
      if (!item || typeof item.id !== 'string' || !/^[a-f\d]{24}$/i.test(item.id) || ids.has(item.id) ||
          typeof item.name !== 'string' || item.name.length > 200 || !Number.isFinite(item.price) || item.price < 0 ||
          !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000000 ||
          !Number.isSafeInteger(item.stock) || item.stock < item.quantity) return false;
      ids.add(item.id); return true;
    }).map(({ id, name, price, quantity, stock }) => ({ id, name, price, quantity, stock }));
    return { ...initialState, cart };
  } catch { return initialState; }
}
/** Réducteur du panier : ajout, quantité, suppression, vidage, livraison et paiement. */
export function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const found = state.cart.find(item => item.id === action.payload.id);
      if (found) {
        const available = Number.isSafeInteger(action.payload.stock) ? action.payload.stock : found.stock;
        if (available <= 0) return state;
        return { ...state, cart: state.cart.map(item => item.id === found.id ?
          { ...item, stock: available,
            price: Number.isFinite(action.payload.price) && action.payload.price >= 0 ? action.payload.price : item.price,
            quantity: Math.min(item.quantity + 1, available, 1000000) } : item) };
      }
      if (!Number.isSafeInteger(action.payload.stock) || action.payload.stock <= 0 || state.cart.length >= 100) return state;
      return { ...state, cart: [...state.cart, { ...action.payload, quantity: 1 }] };
    }
    case 'DECREMENT_QUANTITY': return { ...state, cart: state.cart.map(item => item.id === action.payload.id ?
      { ...item, quantity: Math.max(item.quantity - 1, 1) } : item) };
    case 'REMOVE_FROM_CART': return { ...state, cart: state.cart.filter(item => item.id !== action.payload.id) };
    case 'CLEAR_CART': {
      if (action.payload && JSON.stringify(state.cart.map(({ id, quantity }) => ({ id, quantity }))) !== action.payload) return state;
      return { ...state, cart: [] };
    }
    case 'SET_SHIPPING_METHOD': return { ...state, shippingMethod: action.payload };
    case 'SET_PAYMENT_METHOD': return { ...state, paymentMethod: action.payload };
    case 'SET_SHIPPING_ADDRESS': return { ...state, shippingAddress: action.payload };
    default: return state;
  }
}
/** Fournit le panier (persisté en localStorage, validé à la relecture) à l'application. */
export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, undefined, restore);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, cart: state.cart.map(({ id, name, price, quantity, stock }) => ({ id, name, price, quantity, stock })) })); }
    catch { /* Storage may be disabled; the in-memory cart remains usable. */ }
  }, [state.cart]);
  return <CartContext.Provider value={{ ...state, dispatch }}>{children}</CartContext.Provider>;
}
export const useCart = () => useContext(CartContext);
