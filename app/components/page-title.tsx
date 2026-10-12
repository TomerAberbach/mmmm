import { LetterColors } from './letter-colors.tsx'

// The page's heading and its tab title
export const PageTitle = ({ children }: { children: string }) => (
  <>
    <title>{children}</title>
    <h1 className='font-display text-4xl leading-tight text-balance uppercase sm:text-5xl'>
      <LetterColors text={children} />
    </h1>
  </>
)
