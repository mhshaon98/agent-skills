/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'nbly-demo-project.supabase.co' }
    ]
  },
  experimental: {
    serverActions: { bodySizeLimit: '2mb' }
  }
};

export default nextConfig;
