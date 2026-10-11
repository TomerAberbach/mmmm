import axe from 'axe-core'
import { expect } from 'vitest'

export const expectNoAxeViolations = async (): Promise<void> => {
  const { violations } = await axe.run(document, {
    runOnly: [`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`],
  })
  expect(
    violations.map(({ id, help, nodes }) => ({
      id,
      help,
      targets: nodes.map(({ target }) => target),
    })),
  ).toStrictEqual([])
}
