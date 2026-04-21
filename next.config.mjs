/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Lint issues shouldn't block a production deploy. Run `npm run lint`
    // locally to clean them up.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
