import { Link } from 'react-router'

export const SiteFooter = ({ supportEmail }: { supportEmail?: string }) => (
  <footer className='border-t-2 border-ink print:hidden'>
    <div className='mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-4 py-5 text-sm font-semibold sm:px-6'>
      {supportEmail ? (
        <a
          href={`mailto:${supportEmail}`}
          className='no-underline hover:underline'
        >
          {supportEmail}
        </a>
      ) : null}
      <Link to='/privacy' className='no-underline hover:underline'>
        Privacy policy
      </Link>
    </div>
  </footer>
)
