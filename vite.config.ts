import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  environments: {
    ssr: {
      build: {
        rolldownOptions: {
          input: `./server/app.ts`,
        },
      },
    },
  },
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
})
