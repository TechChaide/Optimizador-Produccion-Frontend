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
        source: '/Aplicativos/ApiOptimizadorProduccion/:path*',
        destination: 'https://intranet.chaide.com/Aplicativos/ApiOptimizadorProduccion/:path*',
      },
    ]
  },
};

export default nextConfig;
