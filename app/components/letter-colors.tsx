// Each passes 3:1 on white, the WCAG minimum for large text
const LETTER_COLORS = [
  `text-accent-strong`,
  `text-muted`,
  `text-accent`,
  `text-muted-light`,
  `text-accent-light`,
] as const

const graphemes = new Intl.Segmenter(`en`, { granularity: `grapheme` })

// Colors each letter in turn, as the March Mammal Madness logo does. Screen
// readers read the text as a whole, not letter by letter
export const LetterColors = ({ text }: { text: string }) => {
  let colorIndex = 0
  const letters = [...graphemes.segment(text)].map(
    ({ segment: letter }, index) => {
      if (letter.trim() === ``) {
        return letter
      }
      const colorClass = LETTER_COLORS[colorIndex % LETTER_COLORS.length]
      colorIndex++
      return (
        <span key={index} className={`${colorClass} print:text-black`}>
          {letter}
        </span>
      )
    },
  )
  return (
    <>
      <span className='sr-only'>{text}</span>
      <span aria-hidden='true'>{letters}</span>
    </>
  )
}
