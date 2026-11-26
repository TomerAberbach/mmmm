import { index, layout, route } from '@react-router/dev/routes'
import type { RouteConfig } from '@react-router/dev/routes'

export default [
  index(`routes/home.tsx`),
  route(`bracket`, `routes/bracket.tsx`),
  route(`privacy`, `routes/privacy.tsx`),
  layout(`routes/signed-out.tsx`, [
    route(`sign-up`, `routes/sign-up.tsx`),
    route(`sign-in`, `routes/sign-in.tsx`),
    route(`sign-in/code`, `routes/sign-in.code.tsx`),
    route(`sign-in/recovery-code`, `routes/sign-in.recovery-code.tsx`),
  ]),
  route(`sign-out`, `routes/sign-out.ts`),
  route(`forgot-password`, `routes/forgot-password.tsx`),
  route(`reset-password`, `routes/reset-password.tsx`),
  route(`settings`, `routes/settings.tsx`, [
    index(`routes/settings._index.tsx`),
    route(`name`, `routes/settings.name.ts`),
    route(`password`, `routes/settings.password.ts`),
    route(`sign-out-others`, `routes/settings.sign-out-others.ts`),
    route(`remove-passkey`, `routes/settings.remove-passkey.ts`),
    route(`authenticator-app`, `routes/settings.authenticator-app.ts`),
  ]),
  route(`contests`, `routes/contests.tsx`, [
    index(`routes/contests._index.tsx`),
    route(`new`, `routes/contests.new.ts`),
    route(`organization`, `routes/contests.organization.ts`),
    route(`leaderboard`, `routes/contests.leaderboard.tsx`),
    route(`leaderboard/:playerId`, `routes/contests.leaderboard.$playerId.tsx`),
    route(`trash`, `routes/contests.trash.tsx`),
    route(`trash/restore`, `routes/contests.trash.restore.ts`),
    route(`trash/erase`, `routes/contests.trash.erase.ts`),
    layout(`routes/contests.contest.tsx`, [
      route(`:contestId`, `routes/contests.$contestId.tsx`),
      route(`:contestId/trash`, `routes/contests.$contestId.trash.tsx`),
      route(
        `:contestId/leaderboard`,
        `routes/contests.$contestId.leaderboard.tsx`,
      ),
      route(
        `:contestId/leaderboard/:playerId`,
        `routes/contests.$contestId.leaderboard.$playerId.tsx`,
      ),
    ]),
    route(`:contestId/name`, `routes/contests.$contestId.name.ts`),
    route(`:contestId/link`, `routes/contests.$contestId.link.ts`),
    route(`:contestId/delete`, `routes/contests.$contestId.delete.ts`),
    route(
      `:contestId/trash/restore`,
      `routes/contests.$contestId.trash.restore.ts`,
    ),
    route(
      `:contestId/trash/erase`,
      `routes/contests.$contestId.trash.erase.ts`,
    ),
    route(
      `:contestId/players/delete`,
      `routes/contests.$contestId.players.delete.ts`,
    ),
    route(
      `:contestId/players/status`,
      `routes/contests.$contestId.players.status.ts`,
    ),
    route(
      `:contestId/players/:playerId/personal-link`,
      `routes/contests.$contestId.players.$playerId.personal-link.ts`,
    ),
    route(
      `:contestId/players/:playerId/name`,
      `routes/contests.$contestId.players.$playerId.name.ts`,
    ),
  ]),
  route(`play/:linkSecret`, `routes/play.tsx`, [
    index(`routes/play._index.tsx`),
    route(`deleted`, `routes/play.deleted.tsx`),
  ]),
  route(`player/:contestId`, `routes/player.tsx`, [
    layout(`routes/player.remembered.tsx`, [
      route(`bracket`, `routes/player.bracket.tsx`),
      route(`bracket/picks`, `routes/player.bracket.picks.ts`),
      layout(`routes/player.approved.tsx`, [
        route(`leaderboard`, `routes/player.leaderboard.tsx`),
        route(
          `leaderboard/:playerId`,
          `routes/player.leaderboard.$playerId.tsx`,
        ),
        route(`organization`, `routes/player.organization.tsx`),
        route(
          `organization/:playerId`,
          `routes/player.organization.$playerId.tsx`,
        ),
      ]),
    ]),
    route(`forgotten`, `routes/player.forgotten.tsx`),
    route(`delete`, `routes/player.delete.ts`),
  ]),
  route(`bracket-deleted`, `routes/bracket-deleted.tsx`),
  route(`contest-removed`, `routes/contest-removed.tsx`),
  route(`my-bracket/:secret`, `routes/my-bracket.tsx`),
  route(`admin`, `routes/admin.tsx`, [
    layout(`routes/admin.second-factor.tsx`, [
      index(`routes/admin._index.tsx`),
      route(`organizations`, `routes/admin.organizations.tsx`),
      route(`organizations/rename`, `routes/admin.organizations.rename.ts`),
      route(`bracket`, `routes/admin.bracket.tsx`),
      route(`results`, `routes/admin.results.tsx`),
      route(`results/save`, `routes/admin.results.save.ts`),
      route(`results/reopen`, `routes/admin.results.reopen.ts`),
      route(`bracket/delete`, `routes/admin.bracket.delete.ts`),
      route(`bracket/publication`, `routes/admin.bracket.publication.ts`),
      route(`bracket/move`, `routes/admin.bracket.move.ts`),
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
