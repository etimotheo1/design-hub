/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We use Node's built-in node:sqlite (stable in Node 23+) — no native binding to externalize.
};

module.exports = nextConfig;
