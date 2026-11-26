import type { Route } from './+types/admin.organizations.ts'
import { OrganizationList } from '~/components/organization-list.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import { readOrganizations } from '~/organizations.server.ts'

export const loader = () => readOrganizations()

const AdminOrganizations = ({ loaderData }: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <PageTitle>Organizations</PageTitle>
    <OrganizationList organizations={loaderData} />
  </div>
)
export default AdminOrganizations
