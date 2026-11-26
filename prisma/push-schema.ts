import { spawn } from 'node:child_process'
import {
  BATTLE_COUNTS,
  MAX_WILD_CARD_ENTRANTS,
  ROUNDS,
  SEEDS_PER_DIVISION,
} from '../app/bracket.ts'
import {
  COMBATANT_NAME,
  CONTEST_NAME,
  DISPLAY_NAME,
  DIVISION_NAME,
  ORGANIZATION_NAME,
} from '../app/free-text.ts'

/**
 * Pushes schema.prisma, then adds the CHECK constraints it can't declare. Run
 * it with `node prisma/push-schema.ts`, passing `--force-reset` to empty the
 * database first
 */
export const pushSchema = async ({
  forceReset = false,
  env = process.env,
}: {
  forceReset?: boolean
  env?: NodeJS.ProcessEnv
} = {}): Promise<void> => {
  // Fly sets the name, and `fly deploy --app` takes any app's with this config
  if (forceReset && env.FLY_APP_NAME && env.FLY_APP_NAME !== `mmmm-staging`) {
    throw new Error(`Refusing to empty the database of ${env.FLY_APP_NAME}`)
  }
  await runPrisma([`db`, `push`, ...(forceReset ? [`--force-reset`] : [])], env)
  await runPrisma([`db`, `execute`, `--stdin`], env, readConstraintsSql())
}

/** Applies the migrations, which create what `pushSchema` does */
export const migrate = (env: NodeJS.ProcessEnv): Promise<void> =>
  runPrisma([`migrate`, `deploy`], env)

/**
 * Each constraint drops first, so the SQL reruns safely. The limits come from
 * the app's own constants, so the database and the app can't disagree
 */
export const readConstraintsSql = (): string =>
  [
    check(`SeedSlot`, `seed`, `seed BETWEEN 1 AND ${SEEDS_PER_DIVISION}`),
    check(
      `WildCardEntrant`,
      `index`,
      `index BETWEEN 0 AND ${MAX_WILD_CARD_ENTRANTS - 1}`,
    ),
    check(`Battle`, `index`, `index >= 0 AND index < ${readBattleCountSql()}`),
    checkName(`Division`, DIVISION_NAME.maxLength),
    checkName(`Combatant`, COMBATANT_NAME.maxLength),
    checkName(`Contest`, CONTEST_NAME.maxLength),
    check(
      `Contest`,
      `orphanedFromDomain`,
      `"educatorId" IS NULL OR "orphanedFromDomain" IS NULL`,
    ),
    checkName(`Organization`, ORGANIZATION_NAME.maxLength),
    checkName(`Player`, DISPLAY_NAME.maxLength, `displayName`),
    check(
      `Player`,
      `deletedBy`,
      `("deletedAt" IS NULL) = ("deletedBy" IS NULL)`,
    ),
  ].join(`\n`)

/** The battle's round's count, or 0 for a round the app doesn't know */
const readBattleCountSql = (): string =>
  `CASE round ${ROUNDS.map(
    round => `WHEN '${round}' THEN ${BATTLE_COUNTS[round]}`,
  ).join(` `)} ELSE 0 END`

const check = (table: string, column: string, condition: string): string => {
  const name = `"${table}_${column}_check"`
  return `ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS ${name}, ADD CONSTRAINT ${name} CHECK (${condition});`
}

/** Trimmed and within the field's length, as `freeTextSchema` requires */
const checkName = (table: string, maxLength: number, column = `name`): string =>
  check(
    table,
    column,
    `"${column}" = btrim("${column}") AND char_length("${column}") BETWEEN 1 AND ${maxLength}`,
  )

const runPrisma = (
  args: string[],
  env: NodeJS.ProcessEnv,
  input?: string,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(`node_modules/.bin/prisma`, args, {
      env,
      stdio: [`pipe`, `inherit`, `inherit`],
    })
    child.on(`error`, reject)
    child.on(`exit`, code => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`prisma ${args.join(` `)} exited with ${code}`))
      }
    })
    child.stdin.end(input)
  })

if (process.argv[1] === import.meta.filename) {
  await pushSchema({ forceReset: process.argv.includes(`--force-reset`) })
}
