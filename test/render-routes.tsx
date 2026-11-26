import { createRoutesStub } from 'react-router'
import { render } from 'vitest-browser-react'

/** Renders stub routes, starting at `path` */
export const renderRoutes = async (
  routes: Parameters<typeof createRoutesStub>[0],
  path = `/`,
): Promise<void> => {
  const Stub = createRoutesStub(routes)
  await render(<Stub initialEntries={[path]} />)
}
