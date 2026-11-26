import { fileURLToPath } from 'node:url'
import { runnerImport } from 'vite'

// Node can't load the emails' TSX or the stylesheet they read their colors from
await runnerImport(fileURLToPath(new URL(`launch.ts`, import.meta.url)), {
  resolve: { tsconfigPaths: true },
})
