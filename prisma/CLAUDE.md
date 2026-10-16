# prisma

- There are no migrations until cutover. Edit `schema.prisma` in place and run
  `pnpm db:reset`, after asking the user as the root CLAUDE.md says. A change
  that keeps every row, such as a relation's `onDelete`, can instead push with
  `node prisma/push-schema.ts`, which needs no reset
- `brackets.ts` holds past brackets as ASU printed them, each under its bracket
  PDF's URL. Add a year from its official PDF, never from memory
- Add a CHECK constraint, which `schema.prisma` can't declare, to
  `readConstraintsSql` in `push-schema.ts`, with its limits taken from the app's
  constants. Push the schema only through `push-schema.ts`, which adds the
  constraints after pushing
