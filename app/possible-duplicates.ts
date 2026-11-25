import type { ContestPlayer } from './contest-players.server.ts'

type NamedPlayer = Pick<ContestPlayer, `id` | `displayName` | `status`>

/**
 * Each player's possible duplicates in the contest, by the player's ID. A
 * rejected player has none. An approved one leaves out rejected players,
 * because the educator has already told the two apart
 */
export const findPossibleDuplicates = <Player extends NamedPlayer>(
  players: Player[],
): Map<string, Player[]> => {
  const playersByName = Map.groupBy(players, ({ displayName }) =>
    normalizeName(displayName),
  )
  // Names of only punctuation or emoji all normalize to nothing
  playersByName.delete(``)

  const duplicates = new Map<string, Player[]>()
  for (const group of playersByName.values()) {
    for (const player of group) {
      const others = group.filter(
        other => other !== player && isWorthNoting(player, other),
      )
      if (others.length > 0) {
        duplicates.set(player.id, others)
      }
    }
  }
  return duplicates
}

/** Leaves out case, spaces, punctuation, and accents */
const normalizeName = (name: string): string =>
  name
    .normalize(`NFKD`)
    .toLowerCase()
    // Only Latin letters' accents, since other scripts' marks, such as Hindi
    // vowel signs, spell different names. A mark on no letter, such as an
    // emoji's variation selector, spells nothing
    .replaceAll(
      /(?<=\p{Script=Latin}\p{M}*)\p{M}|(?<!\p{L}\p{M}*)\p{M}|[^\p{L}\p{M}\p{N}]/gu,
      ``,
    )

const isWorthNoting = (player: NamedPlayer, other: NamedPlayer): boolean =>
  player.status !== `REJECTED` &&
  !(player.status === `APPROVED` && other.status === `REJECTED`)
