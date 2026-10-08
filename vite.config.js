import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main:            resolve(__dirname, 'src/index.html'),
        'custom-homes':  resolve(__dirname, 'src/custom-homes.html'),
        commercial:      resolve(__dirname, 'src/commercial.html'),
        hospitality:     resolve(__dirname, 'src/hospitality.html'),
        'bending-stone': resolve(__dirname, 'src/bending-stone.html'),
        furniture:       resolve(__dirname, 'src/furniture.html'),
        'stone-decorative': resolve(__dirname, 'src/stone-decorative.html'),
        about:           resolve(__dirname, 'src/about.html'),
        contact:         resolve(__dirname, 'src/contact.html'),
        admin:           resolve(__dirname, 'src/admin/index.html'),
      }
    }
  },
  server: {
    port: 5173,
    open: true
  }
})