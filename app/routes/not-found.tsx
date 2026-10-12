import { data } from 'react-router'

// Throwing from a matched route lets the root loader run, so the error page
// keeps the footer's support email
export const loader = () => {
  throw data(null, { status: 404 })
}

// Without a component, React Router would serve the thrown response as is,
// instead of rendering the error page
const NotFound = () => null
export default NotFound
