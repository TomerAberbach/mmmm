import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import type { PasskeyCeremony } from '../passkeys.ts'
import { Button } from './button.tsx'
import { Notice } from './notice.tsx'

// Opens `successTo` once the ceremony succeeds, which loads the session the
// ceremony changed
export const PasskeyButton = ({
  ceremony,
  successTo,
  variant,
  children,
}: {
  ceremony: PasskeyCeremony
  successTo: string
  variant?: `primary` | `secondary`
  children: ReactNode
}) => {
  const navigate = useNavigate()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string>()

  const run = async () => {
    setIsPending(true)
    setError(undefined)
    const failure = await ceremony()
    setIsPending(false)
    if (failure) {
      setError(failure)
      return
    }
    await navigate(successTo)
  }

  return (
    <div className='flex flex-col gap-3'>
      <div>
        <Button
          variant={variant}
          isPending={isPending}
          onPress={() => void run()}
        >
          {children}
        </Button>
      </div>
      {error ? <Notice kind='alert'>{error}</Notice> : null}
    </div>
  )
}
