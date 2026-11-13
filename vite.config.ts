import netlify from '@netlify/vite-plugin-tanstack-start'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The Netlify plugin starts a Deno edge-functions server under `vite dev`, which
// breaks on CI runners. It is only needed to produce the adapter output at build.
export default defineConfig(({ command }) => ({
  server: { port: 3000, strictPort: true },
  resolve: { tsconfigPaths: true },
  plugins: [
    basicSsl(),
    tanstackStart(),
    ...(command === 'build' ? [netlify()] : []),
    viteReact(),
  ],
}))
