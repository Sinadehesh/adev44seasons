/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tauri serves the frontend as a static bundle, so export to `out/`.
  output: 'export',
  // Next's image optimizer needs a server; disable it for static export.
  images: { unoptimized: true },
};

module.exports = nextConfig;
