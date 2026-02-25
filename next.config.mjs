/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

// PWA will be configured later - temporarily disabled to avoid build issues
// import withPWA from 'next-pwa';
// const pwaConfig = withPWA({
//   dest: 'public',
//   register: true,
//   skipWaiting: true,
//   disable: process.env.NODE_ENV === 'development',
//   buildExcludes: [/middleware-manifest\.json$/],
// });
// export default pwaConfig(nextConfig);

export default nextConfig;
