import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PowerSync requires WASM support for @journeyapps/wa-sqlite
  // webpack: (config, { isServer }) => {
  //   if (!isServer) {
  //     // Enable WASM support in the browser
  //     config.experiments = {
  //       ...config.experiments,
  //       asyncWebAssembly: true,
  //     };

  //     // Handle .wasm files
  //     config.module.rules.push({
  //       test: /\.wasm$/,
  //       type: "asset/resource",
  //     });
  //   }

  //   return config;
  // },

  // Required headers for SharedArrayBuffer (needed by wa-sqlite)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
