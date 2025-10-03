import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimize compiler for production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false,
  },
  
  // Experimental optimizations
  experimental: {
    optimizePackageImports: [
      '@copilotkit/react-core',
      '@copilotkit/react-ui',
      '@emoji-mart/react'
    ],
  },
  
  // Output standalone for smaller deployments
  output: 'standalone',
  
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  
  // Reduce bundle size by excluding server-only packages from client
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@prisma/client': false,
        'fs': false,
        'path': false,
        'os': false,
      }
    }
    return config
  }
};

export default nextConfig;
