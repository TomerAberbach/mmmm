import { useState } from 'react'
import type { ReactNode } from 'react'
import { useFetcher } from 'react-router'
import { Button } from './button.tsx'
import { ConfirmDialog } from './confirm-dialog.tsx'
import { FetcherError } from './fetcher-error.tsx'
import { PageHeader } from './page-header.tsx'
import type { ConfirmResult } from '~/form-replies.server.ts'
import { formatCount } from '~/format-count.ts'
import { joinIds } from '~/id-list.ts'

export type TrashItem = {
  id: string
  name: string
  /** What the item was, such as "Approved" */
  detail: string
  /** When it was deleted, and by whom */
  deletion: ReactNode
}

/**
 * A page of deleted items, each with Restore and Delete forever. An item that
 * leaves passes focus to the next one, and a screen reader hears what happened
 */
export const TrashList = ({
  title,
  noun,
  items,
  restorePath,
  erasePath,
  eraseTitle,
  children,
}: {
  title: string
  /** What an item is called, such as "bracket" */
  noun: string
  items: TrashItem[]
  restorePath: string
  erasePath: string
  eraseTitle: (item: TrashItem) => string
  /** How long items can be restored */
  children: ReactNode
}) => {
  const fetcher = useFetcher<ConfirmResult>()
  const [announcement, setAnnouncement] = useState(``)
  const [leaving, setLeaving] = useState<Leaving>()

  const hasLeft =
    leaving !== undefined &&
    Boolean(fetcher.data && `ok` in fetcher.data) &&
    !items.some(({ id }) => leaving.ids.includes(id))
  /** Runs as React attaches the element that takes focus */
  const focusAfterLeaving =
    (id: string | null) => (element: HTMLElement | null) => {
      if (!element || !hasLeft || leaving.focusId !== id) {
        return
      }
      setLeaving(undefined)
      setAnnouncement(leaving.announcement)
      ;(element.querySelector<HTMLElement>(`button`) ?? element).focus()
    }
  const submit = (
    action: string,
    leavingItems: TrashItem[],
    announced: string,
  ) => {
    const ids = leavingItems.map(({ id }) => id)
    const index = items.findIndex(({ id }) => id === ids[0])
    const remaining = items.filter(({ id }) => !ids.includes(id))
    setAnnouncement(``)
    setLeaving({
      ids,
      focusId: (remaining[index] ?? remaining.at(-1))?.id ?? null,
      announcement: announced,
    })
    void fetcher.submit(
      { ids: joinIds(leavingItems) },
      { method: `post`, action },
    )
  }
  const isPending = fetcher.state !== `idle`
  const count = formatCount(items.length, noun)

  return (
    <div className='flex flex-col gap-4'>
      <p className='sr-only' aria-live='polite'>
        {announcement}
      </p>
      <PageHeader
        title={title}
        action={
          items.length > 0 ? (
            <ConfirmDialog
              trigger={
                <Button variant='secondary' isDisabled={isPending}>
                  Empty trash
                </Button>
              }
              title='Empty the trash?'
              confirmLabel='Empty trash'
              onConfirm={() => submit(erasePath, items, `Emptied the trash`)}
            >
              <p>{`${count} will be deleted forever. ${FOREVER_NOTE}`}</p>
            </ConfirmDialog>
          ) : null
        }
      />
      <FetcherError fetcher={fetcher} />
      {items.length === 0 ? (
        <p
          ref={focusAfterLeaving(null)}
          tabIndex={-1}
          className='text-muted outline-none'
        >
          The trash is empty.
        </p>
      ) : (
        <>
          <p className='max-w-prose'>{children}</p>
          <ul className='flex flex-col border-t-2 border-ink'>
            {items.map(item => (
              <TrashRow
                key={item.id}
                item={item}
                rowRef={focusAfterLeaving(item.id)}
                isPending={isPending}
                eraseTitle={eraseTitle(item)}
                onRestore={() =>
                  submit(restorePath, [item], `Restored ${item.name}`)
                }
                onErase={() =>
                  submit(erasePath, [item], `Deleted ${item.name} forever`)
                }
              />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

const TrashRow = ({
  item,
  rowRef,
  isPending,
  eraseTitle,
  onRestore,
  onErase,
}: {
  item: TrashItem
  rowRef: (element: HTMLElement | null) => void
  isPending: boolean
  eraseTitle: string
  onRestore: () => void
  onErase: () => void
}) => (
  <li
    ref={rowRef}
    className='flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-muted-light py-3'
  >
    <div className='min-w-0'>
      <p className='wrap-break-word'>
        <span className='font-semibold'>{item.name}</span>
        <span className='text-muted'>{` · ${item.detail}`}</span>
      </p>
      <p className='text-muted'>{item.deletion}</p>
    </div>
    <div className='flex flex-wrap gap-2'>
      <Button
        variant='secondary'
        isDisabled={isPending}
        aria-label={`Restore ${item.name}`}
        onPress={onRestore}
      >
        Restore
      </Button>
      <ConfirmDialog
        trigger={
          <Button
            variant='quiet'
            isDisabled={isPending}
            aria-label={`Delete forever: ${item.name}`}
          >
            Delete forever
          </Button>
        }
        title={eraseTitle}
        confirmLabel='Delete forever'
        onConfirm={onErase}
      >
        <p>{FOREVER_NOTE}</p>
      </ConfirmDialog>
    </div>
  </li>
)

const FOREVER_NOTE = `This can’t be undone, though backups keep the data for up to 30 days.`

/** Items waiting to leave the list once the page reloads it */
type Leaving = {
  ids: string[]
  /** The item that takes focus, or null once the list is empty */
  focusId: string | null
  announcement: string
}
