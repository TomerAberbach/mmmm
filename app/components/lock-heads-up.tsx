// The admin's expected lock date, which locks nothing itself
export const LockHeadsUp = ({
  expectedLockDate,
}: {
  expectedLockDate: string
}) => (
  <p className='border-s-4 border-accent ps-3'>
    Expected to lock {expectedLockDate}. Players can submit until the first
    result is posted.
  </p>
)
