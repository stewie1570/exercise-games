import { defineConfig } from "vitest/config";
import { transformWithEsbuild } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";

export default defineConfig({
  plugins: [
    {
      name: "fix-mediapipe-sourcemap",
      enforce: "pre",
      load(id) {
        const file = id.split("?")[0];
        if (!file.includes("@mediapipe/tasks-vision") || !/\.(mjs|cjs|js)$/.test(file)) {
          return null;
        }

        return fs.readFileSync(file, "utf8").replace(/\/\/# sourceMappingURL=.*$/m, "");
      },
    },
    {
      name: "treat-js-files-as-jsx",
      async transform(code, id) {
        if (!id.match(/src\/.*\.js$/)) {
          return null;
        }

        return transformWithEsbuild(code, id, {
          loader: "jsx",
          jsx: "automatic",
        });
      },
    },
    react(),
  ],
  optimizeDeps: {
    exclude: ["@mediapipe/tasks-vision"],
    esbuildOptions: {
      loader: {
        ".js": "jsx",
      },
    },
  },
  build: {
    outDir: "build",
    sourcemap: true,
    emptyOutDir: true,
  },
  server: {
    port: Number(process.env.PORT) || 3000,
    strictPort: true,
    host: "127.0.0.1",
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.js",
    fileParallelism: false,
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.*"],
    },
  },
});
