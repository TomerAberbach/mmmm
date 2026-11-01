import { index, layout, route } from '@react-router/dev/routes'
import type { RouteConfig } from '@react-router/dev/routes'

export default [
  index(`routes/home.tsx`),
  route(`bracket`, `routes/bracket.tsx`),
  route(`privacy`, `routes/privacy.tsx`),
  route(`sign-up`, `routes/sign-up.tsx`),
  route(`sign-in`, `routes/sign-in.tsx`),
  route(`sign-out`, `routes/sign-out.ts`),
  route(`forgot-password`, `routes/forgot-password.tsx`),
  route(`reset-password`, `routes/reset-password.tsx`),
  route(`sign-in/code`, `routes/sign-in.code.tsx`),
  route(`sign-in/recovery-code`, `routes/sign-in.recovery-code.tsx`),
  route(`settings`, `routes/settings.tsx`, [
    index(`routes/settings._index.tsx`),
    route(`name`, `routes/settings.name.ts`),
    route(`password`, `routes/settings.password.ts`),
    route(`sign-out-others`, `routes/settings.sign-out-others.ts`),
    route(`remove-passkey`, `routes/settings.remove-passkey.ts`),
    route(`authenticator-app`, `routes/settings.authenticator-app.ts`),
  ]),
  route(`admin`, `routes/admin.tsx`, [
    layout(`routes/admin.second-factor.tsx`, [
      index(`routes/admin._index.tsx`),
      route(`bracket`, `routes/admin.bracket.tsx`),
      route(`bracket/publication`, `routes/admin.bracket.publication.ts`),
      route(`bracket/rename`, `routes/admin.bracket.rename.ts`),
      route(
        `bracket/expected-lock-date`,
        `routes/admin.bracket.expected-lock-date.ts`,
      ),
    ]),
    route(`setup`, `routes/admin.setup.tsx`),
    route(
      `setup/authenticator-app`,
      `routes/admin.setup.authenticator-app.tsx`,
    ),
    route(`verify`, `routes/admin.verify.tsx`),
  ]),
  route(`resend-confirmation`, `routes/resend-confirmation.ts`),
  route(`api/auth/*`, `routes/api.auth.ts`),
  route(`healthz`, `routes/healthz.ts`),
  route(`dev/mailbox`, `routes/mailbox.tsx`),
  route(`*`, `routes/not-found.tsx`),
] satisfies RouteConfig
