import type { Route } from './+types/settings._index.ts'
import { EducatorSettings } from '~/components/educator-settings.tsx'
import { readSecondFactorSettings } from '~/second-factor-settings.server.ts'
import { readRequiredEducator, readRequiredSession } from '~/session.server.ts'

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const educator = readRequiredEducator(context)
  return {
    name: educator.name,
    secondFactors: await readSecondFactorSettings(
      educator,
      readRequiredSession(context),
      request.headers,
    ),
  }
}

const Settings = ({ loaderData }: Route.ComponentProps) => (
  <EducatorSettings
    name={loaderData.name}
    secondFactors={loaderData.secondFactors}
  />
)
export default Settings
