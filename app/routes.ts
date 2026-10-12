import { index, route } from '@react-router/dev/routes'
import type { RouteConfig } from '@react-router/dev/routes'

export default [
  index(`routes/home.tsx`),
  route(`privacy`, `routes/privacy.tsx`),
  route(`sign-up`, `routes/sign-up.tsx`),
  route(`sign-in`, `routes/sign-in.tsx`),
  route(`sign-out`, `routes/sign-out.ts`),
  route(`forgot-password`, `routes/forgot-password.tsx`),
  route(`reset-password`, `routes/reset-password.tsx`),
  route(`settings`, `routes/settings.tsx`, [
    index(`routes/settings._index.tsx`),
    route(`name`, `routes/settings.name.ts`),
    route(`password`, `routes/settings.password.ts`),
    route(`sign-out-others`, `routes/settings.sign-out-others.ts`),
  ]),
  route(`resend-confirmation`, `routes/resend-confirmation.ts`),
  route(`api/auth/*`, `routes/api.auth.ts`),
  route(`healthz`, `routes/healthz.ts`),
  route(`dev/mailbox`, `routes/mailbox.tsx`),
  route(`*`, `routes/not-found.tsx`),
] satisfies RouteConfig
