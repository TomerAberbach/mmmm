import type { Route } from './+types/admin.organizations.data.ts'
import { countOrganizationData } from '~/support.server.ts'
import type { OrganizationData } from '~/support.server.ts'

/** Loaded by the deletion dialog as it opens */
export const loader = ({
  request,
}: Route.LoaderArgs): Promise<OrganizationData> =>
  countOrganizationData(new URL(request.url).searchParams.get(`domain`) ?? ``)
