import type { Route } from './+types/settings._index.ts'
import { EducatorSettings } from '~/components/educator-settings.tsx'
import { countContests } from '~/educator-deletion.server.ts'
import { readOrganization } from '~/organizations.server.ts'
import { readSecondFactorSettings } from '~/second-factor-settings.server.ts'
import { mayDeleteAccount, readSecondFactors } from '~/second-factor.server.ts'
import { readRequiredEducator, readRequiredSession } from '~/session.server.ts'

export const loader = async ({ request, context }: Route.LoaderArgs) => {
  const educator = readRequiredEducator(context)
  const session = readRequiredSession(context)
  const [organization, contestCount, secondFactors, canDelete] =
    await Promise.all([
      readOrganization(educator.id),
      countContests(educator.id),
      readSecondFactorSettings(educator, session, request.headers),
      readSecondFactors(educator.id).then(current =>
        mayDeleteAccount(session.assurance, current),
      ),
    ])
  return {
    name: educator.name,
    account: {
      email: educator.email,
      contestCount,
      isConfirmed: educator.emailVerified,
    },
    canDelete,
    organization,
    secondFactors,
  }
}

const Settings = ({ loaderData }: Route.ComponentProps) => (
  <EducatorSettings
    name={loaderData.name}
    account={loaderData.account}
    canDelete={loaderData.canDelete}
    organization={loaderData.organization}
    secondFactors={loaderData.secondFactors}
  />
)
export default Settings
