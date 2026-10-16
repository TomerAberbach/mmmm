import type { Route } from './+types/admin._index.ts'
import { readBracketPublication } from '~/brackets.server.ts'
import type { BracketPublication } from '~/brackets.server.ts'
import { ButtonLink } from '~/components/button.tsx'
import { PageTitle } from '~/components/page-title.tsx'
import { SECTION_HEADING_CLASS_NAME } from '~/components/settings-section.tsx'
import { readUpcomingYear } from '~/year.ts'

export const loader = async () => {
  const year = readUpcomingYear(new Date())
  return { year, publication: await readBracketPublication(year) }
}

const PUBLICATION_LABELS: Record<BracketPublication, string> = {
  missing: `Not set up yet`,
  unpublished: `Unpublished`,
  published: `Published`,
}

// A published bracket can't be set up again
const LINK_LABELS: Record<BracketPublication, string | undefined> = {
  missing: `Set up`,
  unpublished: `Edit`,
  published: undefined,
}

const Admin = ({ loaderData: { year, publication } }: Route.ComponentProps) => (
  <div className='flex flex-col gap-8'>
    <PageTitle>Admin</PageTitle>
    <section className='flex max-w-xl flex-col gap-3 border-2 border-ink p-5'>
      <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
        <h2 className={SECTION_HEADING_CLASS_NAME}>{year} bracket</h2>
        <span className='text-muted'>{PUBLICATION_LABELS[publication]}</span>
      </div>
      {publication === `missing` ? (
        <p className='text-muted'>
          ASU publishes its bracket in March. Enter it here, check it, then
          publish it.
        </p>
      ) : null}
      {LINK_LABELS[publication] ? (
        <div>
          <ButtonLink href='/admin/bracket'>
            {`${LINK_LABELS[publication]} the ${year} bracket`}
          </ButtonLink>
        </div>
      ) : null}
    </section>
  </div>
)
export default Admin
