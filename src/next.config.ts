
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
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
    ],
  },
  async rewrites() {
    return [
      {
        // Proxy para el motor de consultas genérico
        source: '/Aplicativos/ApiOptimizadorProduccion/:path*',
        destination: 'https://intranet.chaide.com/Aplicativos/ApiOptimizadorProduccion/:path*',
      },
      {
        // Proxy para los servicios de la API de Producción (Quito/Guayaquil)
        source: '/ProductionOptimizer/:path*',
        destination: 'https://apps.chaide.com/ProductionOptimizer/:path*',
      },
      {
        // Proxy para los servicios de Seguridades y Fichas de Usuarios
        source: '/seguridades/:path*',
        destination: 'https://apps.chaide.com/seguridades/:path*',
      },
    ]
  },
};

export default nextConfig;
