import { index, route } from '@react-router/dev/routes'
import type { RouteConfig } from '@react-router/dev/routes'

export default [
  index(`routes/home.tsx`),
  route(`privacy`, `routes/privacy.tsx`),
  route(`api/auth/*`, `routes/api.auth.ts`),
  route(`healthz`, `routes/healthz.ts`),
  route(`dev/dialog`, `routes/dev.dialog.tsx`),
  route(`*`, `routes/not-found.tsx`),
] satisfies RouteConfig
