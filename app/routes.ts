import { index, route } from '@react-router/dev/routes'
import type { RouteConfig } from '@react-router/dev/routes'

export default [
  index(`routes/home.tsx`),
  route(`privacy`, `routes/privacy.tsx`),
  route(`sign-up`, `routes/sign-up.tsx`),
  route(`sign-in`, `routes/sign-in.tsx`),
  route(`sign-out`, `routes/sign-out.ts`),
  route(`resend-confirmation`, `routes/resend-confirmation.ts`),
  route(`api/auth/*`, `routes/api.auth.ts`),
  route(`healthz`, `routes/healthz.ts`),
  route(`dev/dialog`, `routes/dev.dialog.tsx`),
  route(`dev/mailbox`, `routes/mailbox.tsx`),
  route(`*`, `routes/not-found.tsx`),
] satisfies RouteConfig
