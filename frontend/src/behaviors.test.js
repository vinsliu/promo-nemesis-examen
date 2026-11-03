import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CartProvider, cartReducer, useCart } from './context/CartContext';
import ProductList from './pages/ProductList';
import Order from './pages/Order';
import ShippingPayment from './pages/ShippingPayment';
import Admin from './pages/Admin';
import { useSession } from './services/session';
import ProtectedRoute from './components/ProtectedRoute';
import ShippingMethodSelection from './components/ShippingMethodSelection';
import PaymentMethodSelection from './components/handlePaymentChange';
import { createOrder, fetchProducts } from './services/api';
import * as adminApi from './services/adminApi';
import { getOrderAttempt, clearOrderAttempt } from './services/orderAttempt';

jest.mock('./services/api', () => ({ fetchProducts: jest.fn(), createOrder: jest.fn() }));
jest.mock('./services/adminApi', () => ({ getOrders: jest.fn(), getProducts: jest.fn(), updateOrderStatus: jest.fn(), validateOrder: jest.fn(), deleteOrder: jest.fn(), updateProductStock: jest.fn() }));
jest.mock('./services/orderAttempt', () => ({ getOrderAttempt: jest.fn(), clearOrderAttempt: jest.fn() }));
const id = '507f1f77bcf86cd799439011';
const product = { id, _id: id, name: 'Produit test', price: 12, stock: 3, quantity: 1 };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); jest.clearAllMocks(); window.alert = jest.fn(); window.confirm = jest.fn(() => true); });

function CartProbe() {
  const { cart, shippingMethod, paymentMethod, dispatch } = useCart();
  return <><output data-testid="cart">{JSON.stringify(cart)}</output><output>{shippingMethod}/{paymentMethod}</output>
    <button onClick={() => dispatch({ type: 'ADD_TO_CART', payload: product })}>Ajouter test</button>
    <button onClick={() => dispatch({ type: 'SET_SHIPPING_ADDRESS', payload: { street: 'private-address' } })}>Adresse test</button></>;
}
test('cart increment preserves previous state and persists only validated public cart data', async () => {
  const state = { cart: [{ ...product }] }; const next = cartReducer(state, { type: 'ADD_TO_CART', payload: { id } });
  expect(state.cart[0].quantity).toBe(1); expect(next.cart[0].quantity).toBe(2);
  const first = render(<CartProvider><CartProbe /></CartProvider>);
  fireEvent.click(screen.getByText('Ajouter test')); fireEvent.click(screen.getByText('Adresse test'));
  await waitFor(() => expect(localStorage.getItem('cart-v1')).toContain('Produit test'));
  expect(localStorage.getItem('cart-v1')).not.toContain('private-address');
  first.unmount(); render(<CartProvider><CartProbe /></CartProvider>);
  expect(screen.getByTestId('cart')).toHaveTextContent('Produit test');
});
test('malformed cart storage is ignored and selectors start with real context defaults', () => {
  localStorage.setItem('cart-v1', '{bad');
  render(<CartProvider><CartProbe /><ShippingMethodSelection /><PaymentMethodSelection /></CartProvider>);
  expect(screen.getByTestId('cart')).toHaveTextContent('[]');
  expect(screen.getByLabelText('Méthode de livraison:')).toHaveValue('colissimo');
  expect(screen.getByLabelText('Mode de paiement:')).toHaveValue('Carte bancaire');
});
test('catalogue offers retry after failure and disables exhausted products', async () => {
  fetchProducts.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: [{ ...product, stock: 0 }] });
  render(<CartProvider><ProductList /></CartProvider>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Impossible');
  fireEvent.click(screen.getByText('Réessayer'));
  expect(await screen.findByRole('button', { name: 'Rupture de stock' })).toBeDisabled();
});
test('expired session redirects to login while preserving the requested location', async () => {
  localStorage.setItem('session', JSON.stringify({ expiresAt: 1, userId: id, username: 'u', role: 'user' }));
  render(<MemoryRouter initialEntries={['/order']}><Routes><Route path="/order" element={<ProtectedRoute><p>Protected</p></ProtectedRoute>} />
    <Route path="/login" element={<p>Connexion nécessaire</p>} /></Routes></MemoryRouter>);
  expect(await screen.findByText('Connexion nécessaire')).toBeInTheDocument(); expect(screen.queryByText('Protected')).not.toBeInTheDocument();
});
function CheckoutFixture() {
  const { dispatch } = useCart();
  return <><button onClick={() => { dispatch({ type: 'ADD_TO_CART', payload: product }); dispatch({ type: 'SET_SHIPPING_ADDRESS', payload: { street: 'rue', city: 'Paris', postalCode: '75000', country: 'France' } }); }}>Préparer</button><Order /></>;
}
test('checkout locks double clicks and retains the same attempt across a network retry', async () => {
  let reject; getOrderAttempt.mockResolvedValue('same-idempotency-key');
  createOrder.mockImplementationOnce(() => new Promise((resolve, fail) => { reject = fail; })).mockResolvedValueOnce({ data: {} });
  render(<MemoryRouter><CartProvider><CheckoutFixture /></CartProvider></MemoryRouter>);
  fireEvent.click(screen.getByText('Préparer'));
  fireEvent.click(screen.getByText('Confirmer la commande')); fireEvent.click(screen.getByText('Confirmation en cours…'));
  await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
  reject(new Error('response lost'));
  await waitFor(() => expect(screen.getByText('Confirmer la commande')).toBeEnabled());
  expect(clearOrderAttempt).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Confirmer la commande'));
  await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(2));
  expect(createOrder.mock.calls[0][1]).toBe(createOrder.mock.calls[1][1]);
  await waitFor(() => expect(clearOrderAttempt).toHaveBeenCalledTimes(1));
});
test('admin validation updates both list and open details, and zero stock is accepted', async () => {
  const order = { _id: id, status: 'En attente', total: 12, items: [{ productId: id, quantity: 1, price: 12 }] };
  adminApi.getOrders.mockResolvedValue({ data: [order] }); adminApi.getProducts.mockResolvedValue({ data: [product] });
  adminApi.validateOrder.mockResolvedValue({ data: { order: { ...order, status: 'En cours de traitement' } } });
  adminApi.updateProductStock.mockResolvedValue({ data: { product: { ...product, stock: 0 } } });
  render(<Admin />); fireEvent.click(await screen.findByText('Détails')); fireEvent.click(screen.getByText('Valider la commande'));
  await waitFor(() => expect(screen.getAllByText('Statut : En cours de traitement')).toHaveLength(2));
  fireEvent.change(screen.getByLabelText('Nouveau stock Produit test'), { target: { value: '0' } }); fireEvent.click(screen.getByText('Mettre à jour'));
  await waitFor(() => expect(adminApi.updateProductStock).toHaveBeenCalledWith(id, 0));
});


test.each([[false, 'colissimo', 'Carte bancaire'], [true, 'chronopost', 'PayPal']])(
  'selectors reach the order summary (changed: %s)', (change, shipping, payment) => {
    localStorage.setItem('cart-v1', JSON.stringify({ version: 1, cart: [product] }));
    render(<CartProvider><MemoryRouter initialEntries={['/shipping-payment']}><Routes>
      <Route path="/shipping-payment" element={<ShippingPayment />} />
      <Route path="/order" element={<Order />} />
    </Routes></MemoryRouter></CartProvider>);
    if (change) {
      fireEvent.change(screen.getByLabelText('Méthode de livraison:'), { target: { value: shipping } });
      fireEvent.change(screen.getByLabelText('Mode de paiement:'), { target: { value: payment } });
    }
    fireEvent.click(screen.getByText('Passer une commande'));
    expect(screen.getByText('Synthèse de la commande')).toBeInTheDocument();
    expect(screen.getByText(shipping)).toBeInTheDocument();
    expect(screen.getByText(payment)).toBeInTheDocument();
    expect(screen.queryByText('Non spécifiée')).not.toBeInTheDocument();
  });

test('session expiry clears stored credentials and updates the mounted interface', () => {
  jest.useFakeTimers();
  localStorage.setItem('session', JSON.stringify({ expiresAt: Date.now() + 1000, userId: id, username: 'Admin', role: 'admin' }));
  function SessionProbe() { const session = useSession(); return <p>{session ? session.username : 'Session terminée'}</p>; }
  const view = render(<SessionProbe />);
  expect(screen.getByText('Admin')).toBeInTheDocument();
  act(() => { jest.advanceTimersByTime(2000); });
  expect(screen.getByText('Session terminée')).toBeInTheDocument();
  expect(localStorage.getItem('session')).toBeNull();
  view.unmount(); jest.useRealTimers();
});
