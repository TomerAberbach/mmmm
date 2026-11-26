# prisma

- Development, tests, and staging push `schema.prisma`. Production applies
  `migrations/`, and `test/migrations.test.ts` fails when the two differ. Until
  production's database exists, edit `schema.prisma` in place and run
  `pnpm db:baseline`. After that, add a migration for each change, and never
  edit an applied one
- To update the development database, run `pnpm db:reset`, after asking the user
  as the root CLAUDE.md says. A change that keeps every row, such as a
  relation's `onDelete`, can instead push with `node prisma/push-schema.ts`,
  which needs no reset
- `brackets.ts` holds past brackets as ASU printed them, each under its bracket
  PDF's URL. Add a year from its official PDF, never from memory
- Add a CHECK constraint, which `schema.prisma` can't declare, to
  `readConstraintsSql` in `push-schema.ts`, with its limits taken from the app's
  constants, and to a migration. Push the schema only through `push-schema.ts`,
  which adds the constraints after pushing
