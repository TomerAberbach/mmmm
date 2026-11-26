import { useRouteLoaderData } from 'react-router'
import type { loader as rootLoader } from '~/root.tsx'

/** Plain text on an error page when root's loader itself failed */
export const SupportLink = () => {
  const supportEmail =
    useRouteLoaderData<typeof rootLoader>(`root`)?.supportEmail
  return supportEmail === undefined ? (
    `support`
  ) : (
    <a href={`mailto:${supportEmail}`} className='wrap-anywhere'>
      {supportEmail}
    </a>
  )
}
