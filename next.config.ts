import { environment } from '@/environments/environments.prod';
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {

  basePath: environment.basePath,

  output: 'standalone',
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        // Proxy para redirigir peticiones locales a la API de Chaide evitando CORS
        // Actualizado a la URL reportada por el usuario (apps.chaide.com)
        source: '/Aplicativos/ApiOptimizadorProduccion/:path*',
        destination: 'https://apps.chaide.com/ProductionOptimizer/:path*',
      },
    ]
  },
};

export default nextConfig;
