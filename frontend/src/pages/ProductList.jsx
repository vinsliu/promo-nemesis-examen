import React, { useEffect, useState } from 'react';
import { fetchProducts } from '../services/api';
import { useCart } from '../context/CartContext';
/**
 * Page d'accueil : catalogue des produits avec états de chargement et d'erreur (bouton Réessayer).
 * Le bouton d'ajout est désactivé en rupture de stock ; le stock affiché est celui du serveur.
 */
const ProductList = () => {
  const [products, setProducts] = useState([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0);
  const { dispatch } = useCart();
  useEffect(() => {
    let mounted = true; setLoading(true); setError('');
    fetchProducts().then(response => { if (mounted) setProducts(response.data); })
      .catch(() => { if (mounted) setError('Impossible de charger les produits.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [attempt]);
  return <div className="p-8"><h2 className="text-2xl font-bold mb-4">Liste des Produits</h2>
    {loading && <p role="status">Chargement des produits…</p>}
    {error && <div role="alert">{error} <button onClick={() => setAttempt(value => value + 1)}>Réessayer</button></div>}
    {!loading && !error && products.length === 0 && <p>Aucun produit disponible.</p>}
    <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{products.map(product =>
      <li key={product._id} className="border p-4 rounded shadow"><h3 className="text-lg font-semibold">{product.name}</h3>
        <p>{product.price} €</p><p>Stock disponible : {product.stock}</p>
        <button disabled={product.stock <= 0} className="bg-green-500 text-white px-4 py-2 mt-2 rounded"
          onClick={() => dispatch({ type: 'ADD_TO_CART', payload: { ...product, id: product._id } })}>
          {product.stock > 0 ? 'Ajouter au panier' : 'Rupture de stock'}</button>
      </li>)}</ul></div>;
};
export default ProductList;
