// Where an educator lands after signing in
export const EDUCATOR_DASHBOARD_PATH = `/contests`

// The contest link's page, where players start or continue their brackets
export const toContestPath = (linkSecret: string): string =>
  `/play/${linkSecret}`

// A player's bracket in the contest, for the player the browser remembers
export const toBracketPath = (linkSecret: string): string =>
  `${toContestPath(linkSecret)}/bracket`
