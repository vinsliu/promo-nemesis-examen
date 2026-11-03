import React, { useEffect, useState } from 'react';
import { getOrders, getProducts, updateOrderStatus, validateOrder, deleteOrder, updateProductStock } from '../services/adminApi';
const transitions = { 'En attente': ['En cours de traitement', 'Annulée'], 'En cours de traitement': ['Expédiée', 'Annulée'], 'Expédiée': ['Délivrée'], 'Délivrée': [], 'Annulée': [] };
const Admin = () => {
  const [orders, setOrders] = useState([]); const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState(null); const [busy, setBusy] = useState(null);
  const [newStock, setNewStock] = useState({}); const [error, setError] = useState('');
  const [loading, setLoading] = useState(true); const [reload, setReload] = useState(0);
  const selectedOrder = orders.find(order => order._id === selectedId);
  useEffect(() => {
    let mounted = true; setLoading(true); setError('');
    Promise.allSettled([getOrders(), getProducts()]).then(results => {
      if (!mounted) return;
      if (results[0].status === 'fulfilled') setOrders(results[0].value.data);
      if (results[1].status === 'fulfilled') setProducts(results[1].value.data);
      if (results.some(result => result.status === 'rejected')) setError("Certaines données n'ont pas pu être chargées. Vérifiez vos droits puis réessayez.");
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [reload]);
  async function changeOrder(order, status) {
    setBusy(order._id); setError('');
    try {
      const result = status === 'En cours de traitement' ? await validateOrder(order._id) : await updateOrderStatus(order._id, status);
      setOrders(current => current.map(item => item._id === order._id ? result.data.order : item));
      if (status === 'Annulée') setReload(value => value + 1);
    } catch (failure) { setError(failure.response?.data?.message || 'Impossible de modifier cette commande.'); }
    finally { setBusy(null); }
  }
  async function removeOrder(order) {
    if (!window.confirm('Supprimer cette commande et restituer son stock ?')) return;
    setBusy(order._id); setError('');
    try { await deleteOrder(order._id); setOrders(current => current.filter(item => item._id !== order._id)); setSelectedId(null); setReload(value => value + 1); }
    catch (failure) { setError(failure.response?.data?.message || 'Impossible de supprimer cette commande.'); }
    finally { setBusy(null); }
  }
  async function changeStock(product) {
    const raw = newStock[product._id];
    if (typeof raw !== 'string' || !/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) { setError('Saisissez un stock entier positif ou nul.'); return; }
    setBusy(product._id); setError('');
    try {
      const result = await updateProductStock(product._id, Number(raw));
      setProducts(current => current.map(item => item._id === product._id ? result.data.product : item));
      setNewStock(current => ({ ...current, [product._id]: '' }));
    } catch (failure) { setError(failure.response?.data?.message || 'Impossible de modifier le stock.'); }
    finally { setBusy(null); }
  }
  return <div className="p-8"><h2 className="text-2xl font-bold mb-4">Page d'administration</h2>
    {loading && <p role="status">Chargement de l'administration…</p>}
    {error && <div role="alert">{error} <button onClick={() => setReload(value => value + 1)}>Réessayer</button></div>}
    <h3 className="text-xl font-semibold">Gestion des Commandes</h3><ul>{orders.map(order =>
      <li key={order._id} className="border p-4 mb-4 rounded"><p>ID : {order._id}</p><p>Statut : {order.status}</p>
        {(transitions[order.status] || []).map(status => <button key={status} disabled={!!busy} onClick={() => changeOrder(order, status)} className="bg-blue-500 text-white p-2 mr-2">{status === 'En cours de traitement' ? 'Valider la commande' : status === 'Annulée' ? 'Annuler la commande' : `Passer à ${status}`}</button>)}
        <button onClick={() => setSelectedId(order._id)}>Détails</button>
        {!['Expédiée', 'Délivrée'].includes(order.status) && <button disabled={!!busy} onClick={() => removeOrder(order)}>Supprimer</button>}
      </li>)}</ul>
    <h3 className="text-xl font-semibold">Gestion des Produits</h3><table className="w-full"><thead><tr><th>Nom</th><th>Prix</th><th>Stock disponible</th><th>Actions</th></tr></thead>
      <tbody>{products.map(product => <tr key={product._id}><td>{product.name}</td><td>{product.price} €</td><td>{product.stock}</td><td>
        <input aria-label={`Nouveau stock ${product.name}`} type="number" min="0" step="1" value={newStock[product._id] ?? ''} onChange={event => setNewStock(current => ({ ...current, [product._id]: event.target.value }))} />
        <button disabled={!!busy} onClick={() => changeStock(product)}>Mettre à jour</button></td></tr>)}</tbody></table>
    {selectedOrder && <div role="dialog" aria-modal="true" aria-label="Détails de la commande" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"><div className="bg-white p-6 rounded">
      <h3>Détails de la commande</h3><p>ID : {selectedOrder._id}</p><p>Statut : {selectedOrder.status}</p><p>Total : {selectedOrder.total} €</p>
      <ul>{selectedOrder.items.map(item => <li key={item.productId}>Produit {item.productId} — {item.quantity} × {item.price} €</li>)}</ul>
      <button onClick={() => setSelectedId(null)}>Fermer</button></div></div>}
  </div>;
};
export default Admin;
