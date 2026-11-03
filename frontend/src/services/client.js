import axios from 'axios';
import { API_BASE_URL } from './config';
import { clearSession } from './session';
const client = axios.create({ baseURL: API_BASE_URL, timeout: 20000, withCredentials: true,
  headers: { 'X-Requested-With': 'XMLHttpRequest' } });
client.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401) clearSession();
  return Promise.reject(error);
});
export default client;
