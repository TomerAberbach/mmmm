# server

`app.ts` hands requests to React Router with the request's CSP nonce.

- Logs drop query strings. Add each path segment that holds a secret to
  `SECRET_PATH` in `logging.ts`
- The content security policy blocks `<style>` elements, except ones whose hash
  `styleSrc` in `security.ts` lists, such as React Aria's pressable style. When
  a React Aria upgrade fails `e2e/security.test.ts` with a blocked inline style,
  update the hash from the error
