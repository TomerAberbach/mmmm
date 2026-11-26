/** The admin's expected lock date, which locks nothing itself */
export const LockHeadsUp = ({
  expectedLockDate,
}: {
  expectedLockDate: string
}) => (
  <p className='border-s-4 border-accent ps-3'>
    Brackets are expected to lock on {expectedLockDate}. Players can submit
    until the first result is posted.
  </p>
)
