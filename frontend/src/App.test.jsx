import { render, screen } from '@testing-library/react';
import App from './App';
import { CartProvider } from './context/CartContext';
import { fetchProducts } from './services/api';

jest.mock('./services/api', () => ({
  fetchProducts: jest.fn(),
  createOrder: jest.fn(),
}));

test('loads the catalogue within the application and provides a usable cart', async () => {
  localStorage.clear();
  fetchProducts.mockResolvedValue({ data: [
    { _id: '507f1f77bcf86cd799439011', name: 'Produit de test', price: 12, stock: 3 },
  ] });
  render(<CartProvider><App /></CartProvider>);
  expect(await screen.findByText('Produit de test')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Panier/ })).toHaveAttribute('href', '/cart');
  expect(screen.getByRole('button', { name: 'Ajouter au panier' })).toBeEnabled();
});
