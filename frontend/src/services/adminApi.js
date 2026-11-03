import client from './client';
export const getOrders = () => client.get('/orders');
export const getProducts = () => client.get('/products');
export const updateOrderStatus = (id, status) => client.put(`/orders/${id}/status`, { status });
export const validateOrder = id => client.put(`/orders/${id}/validate`, {});
export const deleteOrder = id => client.delete(`/orders/${id}`);
export const updateProductStock = (id, stock) => client.put(`/products/${id}/stock`, { stock });
