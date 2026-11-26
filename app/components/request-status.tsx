import { Button } from './button.tsx'

/** How a request stands, such as "Saved at 8:14 PM" */
export const RequestNote = ({ children }: { children: string }) => (
  <span className='text-muted'>{children}</span>
)

/** Why a request wasn't made, with what to do about it */
export const RequestAlert = ({
  children,
  action,
}: {
  children: string
  action?: { label: string; onPress: () => void }
}) => (
  <span
    role='alert'
    className='flex items-center gap-2 font-semibold text-danger'
  >
    {children}
    {action ? (
      <Button variant='quiet' onPress={action.onPress}>
        {action.label}
      </Button>
    ) : null}
  </span>
)
