import type { NextConfig } from 'next';

const config: NextConfig = {
  // @mixlab/blend is shipped as TypeScript source inside this repo.
  transpilePackages: ['@mixlab/blend'],
};

export default config;
