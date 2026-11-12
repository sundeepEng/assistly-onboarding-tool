/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["unpdf", "mammoth"],
  reactStrictMode: true,
  transpilePackages: ["react-loader-spinner", "react", "react-dom", "next"],

  images: {
    unoptimized: true,
  },

  productionBrowserSourceMaps: false,

  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
