import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'copy-raw-components',
        closeBundle() {
          const srcDir = path.resolve(process.cwd(), 'src/components');
          const destDir = path.resolve(process.cwd(), 'dist/src/components');
          if (fs.existsSync(srcDir)) {
            fs.mkdirSync(destDir, { recursive: true });
            const files = fs.readdirSync(srcDir);
            for (const file of files) {
              if (file.endsWith('.tsx')) {
                fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
              }
            }
            console.log('Copied raw TSX components to dist/src/components/ for client-side compilation');
          }
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: process.env.BACKEND_URL || 'http://localhost:3200',
          changeOrigin: true,
          secure: false,
        },
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
