import axe from 'axe-core'
import { expect } from 'vitest'

export const expectNoAxeViolations = async (): Promise<void> => {
  // React Aria's announcer outlives the test that announced, and can point at
  // elements that test removed
  const { violations } = await axe.run(
    { include: document, exclude: [`[data-live-announcer]`] },
    {
      runOnly: [`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`],
    },
  )
  expect(
    violations.map(({ id, help, nodes }) => ({
      id,
      help,
      targets: nodes.map(({ target }) => target),
    })),
  ).toStrictEqual([])
}
