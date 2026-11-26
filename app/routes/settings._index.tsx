import type { Route } from './+types/settings._index.ts'
import { EducatorSettings } from '~/components/educator-settings.tsx'
import { countContests } from '~/educator-deletion.server.ts'
import { readOrganization } from '~/organizations.server.ts'
import { readSecondFactorSettings } from '~/second-factor-settings.server.ts'
import { readRequiredEducator, readRequiredSession } from '~/session.server.ts'

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const educator = readRequiredEducator(context)
  const [organization, contestCount, secondFactors] = await Promise.all([
    readOrganization(educator.id),
    countContests(educator.id),
    readSecondFactorSettings(
      educator,
      readRequiredSession(context),
      request.headers,
    ),
  ])
  return {
    name: educator.name,
    account: { email: educator.email, contestCount },
    organization,
    secondFactors,
  }
}

const Settings = ({ loaderData }: Route.ComponentProps) => (
  <EducatorSettings
    name={loaderData.name}
    account={loaderData.account}
    organization={loaderData.organization}
    secondFactors={loaderData.secondFactors}
  />
)
export default Settings
