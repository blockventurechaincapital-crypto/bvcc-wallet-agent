import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@walletconnect/web3wallet',
    '@walletconnect/core',
    '@walletconnect/utils',
    '@walletconnect/sign-client',
    '@walletconnect/relay-client',
  ],
};

export default nextConfig;
