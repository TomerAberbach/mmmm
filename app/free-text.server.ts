import {
  DataSet,
  englishDataset,
  englishRecommendedTransformers,
  RegExpMatcher,
} from 'obscenity'
import type { z } from 'zod'
import { freeTextSchema } from './free-text.ts'
import type { FreeTextField } from './free-text.ts'

const offensiveWords = new RegExpMatcher({
  ...new DataSet<{ originalWord: string }>()
    .addAll(englishDataset)
    // A common first name and surname
    .removePhrasesIf(phrase => phrase.metadata?.originalWord === `dick`)
    .build(),
  ...englishRecommendedTransformers,
})

export const serverFreeTextSchema = (field: FreeTextField): z.ZodString =>
  freeTextSchema(field).refine(
    text => !offensiveWords.hasMatch(text),
    field.offensiveMessage ?? `Remove the offensive words from ${field.label}`,
  )
