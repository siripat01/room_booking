import { defineConfig } from "vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: {
    port: 3001,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    TanStackRouterVite(),
    viteReact(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react":  ["react", "react-dom"],
          "vendor-query":  ["@tanstack/react-query", "@tanstack/react-router"],
          "vendor-charts": ["recharts"],
          "vendor-ui":     ["lucide-react"],
        },
      },
    },
  },
});
