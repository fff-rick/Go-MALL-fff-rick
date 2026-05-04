import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api/user": "http://127.0.0.1:8000",
      "/api/product": "http://127.0.0.1:8001",
      "/api/order": "http://127.0.0.1:8002",
      "/api/pay": "http://127.0.0.1:8003"
    }
  }
});
