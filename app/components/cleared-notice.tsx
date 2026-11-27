/**
 * A row of a bar that wraps. The live region stays in place, so its first
 * message is announced
 */
export const ClearedNotice = ({ message }: { message: string | null }) => (
  <output className={message === null ? `sr-only` : `basis-full font-semibold`}>
    {message}
  </output>
)
