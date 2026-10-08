/** @type {import('next').NextConfig} */
const nextConfig = {
    productionBrowserSourceMaps: false, // Prevent exposing source maps in production
    images: {
        formats: ['image/avif', 'image/webp'],
        minimumCacheTTL: 31536000,
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
    async headers() {
        return [
            {
                // Global security headers for admin routes (exclude /embed and /api so iframe player and API work)
                source: '/((?!embed|api).*)',
                headers: [
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()',
                    },
                ],
            },
            {
                // Embed Player Iframe headers - allowing embedding on any external domain & inside admin previews
                source: '/embed/:path*',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: 'frame-ancestors *',
                    },
                    {
                        key: 'Access-Control-Allow-Origin',
                        value: '*',
                    },
                    {
                        key: 'Access-Control-Allow-Methods',
                        value: 'GET, HEAD, OPTIONS',
                    },
                ],
            },
            {
                // Public Stream API endpoints
                source: '/api/:path*',
                headers: [
                    {
                        key: 'Access-Control-Allow-Origin',
                        value: '*',
                    },
                    {
                        key: 'Access-Control-Allow-Methods',
                        value: 'GET, POST, HEAD, OPTIONS',
                    },
                    {
                        key: 'Access-Control-Allow-Headers',
                        value: 'Range, Origin, Referer, Content-Type, Authorization, x-api-key, apikey',
                    },
                    {
                        key: 'Access-Control-Expose-Headers',
                        value: 'Content-Length, Content-Range, Accept-Ranges',
                    },
                ],
            },
        ];
    },
};

export default nextConfig;

