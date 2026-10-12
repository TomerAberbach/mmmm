import { LetterColors } from './letter-colors.tsx'

export const PageTitle = ({ children }: { children: string }) => (
  <h1 className='font-display text-4xl leading-tight uppercase sm:text-5xl'>
    <LetterColors text={children} />
  </h1>
)
