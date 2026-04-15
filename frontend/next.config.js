/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  async headers() {
    const immutable = 'public, max-age=31536000, immutable'
    return [
      { source: '/icons/:path*',       headers: [{ key: 'Cache-Control', value: immutable }] },
      { source: '/backgrounds/:path*', headers: [{ key: 'Cache-Control', value: immutable }] },
      { source: '/npc/:path*',         headers: [{ key: 'Cache-Control', value: immutable }] },
    ]
  },
}

module.exports = nextConfig
