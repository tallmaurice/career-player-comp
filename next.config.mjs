/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @resvg/resvg-js ships native binaries; keep it external to the server bundle
  // so Next/webpack doesn't try to bundle the .node files.
  serverExternalPackages: ["@resvg/resvg-js"],
};

export default nextConfig;
