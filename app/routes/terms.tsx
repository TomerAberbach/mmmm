import { href, Link } from 'react-router'
import { LegalPage, LegalSection } from '~/components/legal-page.tsx'

const Terms = () => (
  <LegalPage title='Terms'>
    <LegalSection title='Consent for players under 13'>
      <p>
        An educator uses MMMM on behalf of their players’ families. By signing
        up, the educator confirms that they or their school consent to players
        under 13 using MMMM for the classroom, as COPPA allows schools to.
      </p>
    </LegalSection>
    <LegalSection title='What educators agree to'>
      <ul className='flex list-disc flex-col gap-1 ps-5'>
        <li>To share contest links only with their own players.</li>
        <li>
          To ask players for a first name and last initial, and to rename or
          delete a bracket that shows more.
        </li>
        <li>To reject brackets with rude or hurtful names.</li>
        <li>To handle a family’s request to see or delete a bracket.</li>
      </ul>
    </LegalSection>
    <LegalSection title='What MMMM can do'>
      <p>
        MMMM’s admins can hide a contest from the organization and global
        leaderboards, rename it, or delete it forever. They can delete any one
        bracket forever, which also removes its player’s name. They can hand a
        contest whose educator left to another educator. They can rename an
        organization or delete its data, change an account’s email address once
        the new one is confirmed, and delete an account that breaks these terms.
        The service comes without a warranty.
      </p>
    </LegalSection>
    <p>
      The <Link to={href(`/privacy`)}>privacy policy</Link> says what MMMM keeps
      and who sees it.
    </p>
  </LegalPage>
)
export default Terms
