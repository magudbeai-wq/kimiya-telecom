/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3', 'exceljs', 'pg', 'bcryptjs'],
  },
};

export default nextConfig;
