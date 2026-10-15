// The codes of the refusals the app adds to Better Auth's second-factor
// endpoints. Their messages are written for educators
export const SECOND_FACTOR_REQUIRED = `SECOND_FACTOR_REQUIRED`
export const LAST_SECOND_FACTOR = `LAST_SECOND_FACTOR`

export const isSecondFactorRefusal = (code: unknown): boolean =>
  code === SECOND_FACTOR_REQUIRED || code === LAST_SECOND_FACTOR

export const SETUP_LINK_EXPIRES_IN_HOURS = 1
