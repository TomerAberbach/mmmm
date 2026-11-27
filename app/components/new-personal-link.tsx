import { useState } from 'react'
import { href } from 'react-router'
import { z } from 'zod'
import { Button } from './button.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import { CopyButton } from './copy-button.tsx'
import { copyText } from './copy-text.ts'
import { BUTTONS_CLASS_NAME, ModalFrame } from './modal-frame.tsx'
import type { ContestPlayer } from '~/contest-players.server.ts'

/**
 * Confirms replacing a player's personal link, then shows the new link, which
 * the page can't show again. Place it outside the players' rows, since a row
 * that moves to another section would take the link with it
 */
export const NewPersonalLink = ({
  contestId,
  player,
  onClose,
  onDone,
}: {
  contestId: string
  /** The player to confirm for, or null */
  player: ContestPlayer | null
  onClose: () => void
  /** Called once the dialog that shows the outcome closes, so focus can return */
  onDone: (playerId: string) => void
}) => {
  const [outcome, setOutcome] = useState<Outcome>()
  const replace = async ({ id: playerId, displayName }: ContestPlayer) => {
    const link = await requestNewLink(
      href(`/contests/:contestId/players/:playerId/personal-link`, {
        contestId,
        playerId,
      }),
    )
    if (link === null) {
      setOutcome({ kind: `failed`, playerId, displayName })
      return
    }
    // Copying may wait on a permission prompt, so the link shows first
    setOutcome({
      kind: `replaced`,
      playerId,
      displayName,
      link,
      isCopied: false,
    })
    void copyText(link).then(isCopied => {
      if (isCopied) {
        setOutcome(shown =>
          shown?.kind === `replaced` && shown.link === link
            ? { ...shown, isCopied }
            : shown,
        )
      }
    })
  }
  const close = ({ playerId }: Outcome) => {
    // Focus can't leave the dialog until it unmounts
    setOutcome(undefined)
    requestAnimationFrame(() => onDone(playerId))
  }
  return (
    <>
      {player ? (
        <ConfirmDialog
          isOpen
          onOpenChange={onClose}
          title={`Replace ${player.displayName}’s personal link?`}
          confirmLabel='Replace personal link'
          onConfirm={() => replace(player)}
        >
          <p>
            {`The old link stops working, also in any browser that has it open. Give ${player.displayName} the new one, and no one else.`}
          </p>
        </ConfirmDialog>
      ) : null}
      {outcome?.kind === `replaced` ? (
        <NewLinkDialog {...outcome} onClose={() => close(outcome)} />
      ) : null}
      {outcome?.kind === `failed` ? (
        <FailedDialog {...outcome} onClose={() => close(outcome)} />
      ) : null}
    </>
  )
}

type Outcome = { playerId: string; displayName: string } & (
  { kind: `replaced`; link: string; isCopied: boolean } | { kind: `failed` }
)

const NewLinkDialog = ({
  displayName,
  link,
  isCopied,
  onClose,
}: {
  displayName: string
  link: string
  isCopied: boolean
  onClose: () => void
}) => (
  <ModalFrame
    isOpen
    onOpenChange={onClose}
    title={`${displayName}’s new personal link`}
  >
    <p className='border-2 border-ink p-3 font-mono break-all'>{link}</p>
    <p aria-live='polite'>
      {`${isCopied ? `The link is copied.` : `Copy the link now.`} You won’t be able to see it again.`}
    </p>
    <div className={BUTTONS_CLASS_NAME}>
      <CloseButton />
      <CopyButton text={link} />
    </div>
  </ModalFrame>
)

/** The server may have replaced the link before the connection dropped */
const FailedDialog = ({
  displayName,
  onClose,
}: {
  displayName: string
  onClose: () => void
}) => (
  <ModalFrame
    isOpen
    onOpenChange={onClose}
    title={`Couldn’t replace ${displayName}’s personal link`}
  >
    <p>
      Something went wrong, so the old link may or may not still work. Reload
      the page and try again.
    </p>
    <div className={BUTTONS_CLASS_NAME}>
      <CloseButton />
    </div>
  </ModalFrame>
)

const CloseButton = () => (
  <Button slot='close' variant='secondary'>
    Close
  </Button>
)

const newLinkSchema = z.object({ link: z.string() })

/** Null when the server refuses or can't be reached */
const requestNewLink = async (path: string): Promise<string | null> => {
  try {
    const response = await fetch(path, {
      method: `POST`,
      // A signed-out educator's request redirects to a page that answers 200
      redirect: `manual`,
    })
    return response.ok ? newLinkSchema.parse(await response.json()).link : null
  } catch {
    return null
  }
}
