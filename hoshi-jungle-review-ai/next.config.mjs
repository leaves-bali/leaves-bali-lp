/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // tinyld / @anthropic-ai/sdk は Node ランタイム前提。Edge には載せない。
  serverExternalPackages: ['tinyld'],
};

export default nextConfig;
