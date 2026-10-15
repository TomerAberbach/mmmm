// Advance widths in em of Barlow Condensed ExtraBold's uppercase glyphs,
// measured in Chromium. ExtraBold is the widest weight a name shows in
const GLYPH_WIDTHS = new Map<string, number>([
  [` `, 0.2],
  [`!`, 0.289],
  [`"`, 0.385],
  [`#`, 0.626],
  [`$`, 0.454],
  [`%`, 0.761],
  [`&`, 0.624],
  [`'`, 0.188],
  [`(`, 0.343],
  [`)`, 0.343],
  [`*`, 0.362],
  [`+`, 0.437],
  [`,`, 0.223],
  [`-`, 0.337],
  [`.`, 0.235],
  [`/`, 0.444],
  [`0`, 0.456],
  [`1`, 0.294],
  [`2`, 0.451],
  [`3`, 0.446],
  [`4`, 0.508],
  [`5`, 0.45],
  [`6`, 0.451],
  [`7`, 0.422],
  [`8`, 0.446],
  [`9`, 0.446],
  [`:`, 0.298],
  [`;`, 0.246],
  [`<`, 0.437],
  [`=`, 0.437],
  [`>`, 0.437],
  [`?`, 0.462],
  [`@`, 0.76],
  [`A`, 0.508],
  [`B`, 0.477],
  [`C`, 0.47],
  [`D`, 0.48],
  [`E`, 0.441],
  [`F`, 0.427],
  [`G`, 0.473],
  [`H`, 0.483],
  [`I`, 0.235],
  [`J`, 0.462],
  [`K`, 0.505],
  [`L`, 0.437],
  [`M`, 0.558],
  [`N`, 0.522],
  [`O`, 0.479],
  [`P`, 0.474],
  [`Q`, 0.467],
  [`R`, 0.481],
  [`S`, 0.454],
  [`T`, 0.485],
  [`U`, 0.48],
  [`V`, 0.506],
  [`W`, 0.707],
  [`X`, 0.49],
  [`Y`, 0.492],
  [`Z`, 0.419],
  [`[`, 0.36],
  [`\\`, 0.444],
  [`]`, 0.36],
  [`^`, 0.432],
  [`_`, 0.437],
  [`\``, 0.234],
  [`{`, 0.37],
  [`|`, 0.201],
  [`}`, 0.37],
  [`~`, 0.5],
  [`’`, 0.211],
  [`‘`, 0.211],
  [`“`, 0.389],
  [`”`, 0.389],
  [`–`, 0.383],
  [`—`, 0.593],
])

// A character outside the table renders in a fallback font. Emoji and CJK
// characters are about 1em wide there, so this one leaves room for them
const UNKNOWN_GLYPH_WIDTH = 1.25

// `tracking-wide`
const LETTER_SPACING = 0.025

const graphemes = new Intl.Segmenter()

// The width in em of the widest name, uppercased as the boxes show names.
// Kerning only narrows a name, so the estimate never falls short
export const measureWidestName = (names: [string, ...string[]]): number =>
  Math.max(...names.map(measureName))

const measureName = (name: string): number =>
  Array.from(
    graphemes.segment(name.toUpperCase()),
    ({ segment }) =>
      (GLYPH_WIDTHS.get(segment) ?? UNKNOWN_GLYPH_WIDTH) + LETTER_SPACING,
  ).reduce((width, glyphWidth) => width + glyphWidth, 0)
