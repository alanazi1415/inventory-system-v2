const nextConfig = {
  output: 'standalone',
  
  // Security Headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // منع XSS
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          // منع clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          // حماية XSS
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          // Referrer Policy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          // Permissions Policy
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'"
            ].join('; ')
          }
        ]
      },
      // API routes headers
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate'
          },
          {
            key: 'Pragma',
            value: 'no-cache'
          },
          {
            key: 'Expires',
            value: '0'
          }
        ]
      }
    ]
  },
  
  // تجاهل أخطاء ESLint في البناء
  eslint: {
    ignoreDuringBuilds: true
  },
  
  // تجاهل أخطاء TypeScript في البناء (اختياري)
  typescript: {
    ignoreBuildErrors: false
  }
}

export default nextConfig
