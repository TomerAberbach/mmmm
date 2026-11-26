import { href, Link } from 'react-router'

export const HomeLink = () => (
  <p>
    <Link to={href(`/`)} className='font-semibold'>
      Go to the home page
    </Link>
  </p>
)
