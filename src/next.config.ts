
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
        source: '/Aplicativos/ApiOptimizadorProduccion/:path*',
        destination: 'https://intranet.chaide.com/Aplicativos/ApiOptimizadorProduccion/:path*',
      },
    ]
  },
};

export default nextConfig;
