/** The live region stays in place, so its first message is announced */
export const ClearedNotice = ({ message }: { message: string | null }) => (
  <output
    className={
      message === null
        ? `sr-only`
        : `max-w-prose border-2 border-ink bg-white p-3`
    }
  >
    {message}
  </output>
)
