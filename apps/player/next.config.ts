import type { NextConfig } from 'next';

const config: NextConfig = {
  // @mixlab/blend is shipped as TypeScript source inside this repo.
  transpilePackages: ['@mixlab/blend'],
  // No floating dev badge in local screenshots and the demo video.
  devIndicators: false,
};

export default config;
