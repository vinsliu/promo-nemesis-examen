import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    // Preserve the API variable and output directory used by existing deployments.
    define: { 'process.env.REACT_APP_API_BASE_URL': JSON.stringify(env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api') },
    build: { outDir: 'build' },
    server: {
      host: env.HOST || 'localhost',
      port: Number(env.PORT || 3000),
      strictPort: true,
      proxy: { '/api': { target: env.API_PROXY_TARGET || 'http://localhost:5000', changeOrigin: true } },
    },
  };
});
