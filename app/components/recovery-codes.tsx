import { useState } from 'react'
import { Button, ButtonLink } from './button.tsx'
import { Checkbox } from './checkbox.tsx'
import { PageTitle } from './page-title.tsx'

// Shown once, right after the codes are made. Continuing needs the educator to
// say they saved them, since nothing shows them again
export const RecoveryCodes = ({
  codes,
  continueTo,
}: {
  codes: string[]
  continueTo: string
}) => {
  const [isSaved, setIsSaved] = useState(false)
  return (
    <div className='flex max-w-md flex-col gap-6'>
      <PageTitle>Save your recovery codes</PageTitle>
      <p>
        If you lose your phone or passkey, each code signs you in once. Keep
        them somewhere safe, such as a password manager. You won&apos;t see them
        again.
      </p>
      <RecoveryCodeList codes={codes} />
      <Checkbox isSelected={isSaved} onChange={setIsSaved}>
        I&apos;ve saved these codes
      </Checkbox>
      <div>
        <ButtonLink href={continueTo} isDisabled={!isSaved}>
          Continue
        </ButtonLink>
      </div>
    </div>
  )
}

export const RecoveryCodeList = ({ codes }: { codes: string[] }) => {
  const [isCopied, setIsCopied] = useState(false)
  const text = codes.join(`\n`)

  const copy = async () => {
    // Runs only in the browser, so Node's support doesn't apply
    // eslint-disable-next-line node/no-unsupported-features/node-builtins
    await navigator.clipboard.writeText(text)
    setIsCopied(true)
  }

  return (
    <div className='flex flex-col gap-4'>
      <ul className='grid grid-cols-2 gap-x-6 gap-y-2 border-2 border-ink p-4 font-mono tracking-wide'>
        {codes.map(code => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className='flex flex-wrap items-center gap-3 print:hidden'>
        <Button variant='secondary' onPress={() => void copy()}>
          Copy codes
        </Button>
        <ButtonLink
          variant='secondary'
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
          download='mmmm-recovery-codes.txt'
        >
          Download
        </ButtonLink>
        {isCopied ? <output>Copied</output> : null}
      </div>
    </div>
  )
}
