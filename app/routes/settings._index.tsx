import type { Route } from './+types/settings._index.ts'
import { EducatorSettings } from '~/components/educator-settings.tsx'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = ({ context }: Route.LoaderArgs) => ({
  name: readRequiredEducator(context).name,
})

const Settings = ({ loaderData }: Route.ComponentProps) => (
  <EducatorSettings name={loaderData.name} />
)
export default Settings
