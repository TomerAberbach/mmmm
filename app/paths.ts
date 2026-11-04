// Where an educator lands after signing in
export const EDUCATOR_DASHBOARD_PATH = `/contests`

// The contest link's page, where players start or continue their brackets
export const toContestPath = (linkSecret: string): string =>
  `/play/${linkSecret}`

// A player's bracket in the contest, for the player the browser remembers
export const toBracketPath = (linkSecret: string): string =>
  `${toContestPath(linkSecret)}/bracket`

// Saves, submits, or discards the remembered player's picks
export const toPicksPath = (linkSecret: string): string =>
  `${toBracketPath(linkSecret)}/picks`

// Opens the player's bracket on any device
export const toPersonalLinkPath = (secret: string): string =>
  `/my-bracket/${secret}`

// Where a player lands once this browser forgets them
export const toForgottenPath = (linkSecret: string): string =>
  `${toContestPath(linkSecret)}/forgotten`
