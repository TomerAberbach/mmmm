# server

`app.ts` hands requests to React Router with the request's CSP nonce.

- Export what `server.ts` runs against the database, such as the daily job, from
  `app.ts`. Importing it in `server.ts` opens a second connection pool
- Logs drop query strings. Add each path segment that holds a secret to
  `SECRET_PATH` in `logging.ts`
- The content security policy blocks `<style>` elements, except ones whose hash
  `styleSrc` in `security.ts` lists, such as React Aria's pressable style. When
  a React Aria upgrade fails `e2e/app/security.test.ts` with a blocked inline
  style, update the hash from the error
- Key what only HTTPS needs, such as HSTS and `upgrade-insecure-requests`, on
  `isServedOverHttps()` from `app/env.server.ts`, and `trustFlyProxy` on Fly's
  `FLY_APP_NAME`. Keep `isDevelopment()` for what Vite needs
