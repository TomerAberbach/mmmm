import type { Route } from './+types/settings._index.ts'
import { EducatorSettings } from '~/components/educator-settings.tsx'
import { readOrganization } from '~/organizations.server.ts'
import { readSecondFactorSettings } from '~/second-factor-settings.server.ts'
import { readRequiredEducator, readRequiredSession } from '~/session.server.ts'

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const educator = readRequiredEducator(context)
  const [organization, secondFactors] = await Promise.all([
    readOrganization(educator.id),
    readSecondFactorSettings(
      educator,
      readRequiredSession(context),
      request.headers,
    ),
  ])
  return { name: educator.name, organization, secondFactors }
}

const Settings = ({ loaderData }: Route.ComponentProps) => (
  <EducatorSettings
    name={loaderData.name}
    organization={loaderData.organization}
    secondFactors={loaderData.secondFactors}
  />
)
export default Settings
