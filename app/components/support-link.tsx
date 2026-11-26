import { useRouteLoaderData } from 'react-router'
import type { loader as rootLoader } from '~/root.tsx'

export const SupportLink = () => {
  const supportEmail =
    useRouteLoaderData<typeof rootLoader>(`root`)?.supportEmail ?? ``
  return (
    <a href={`mailto:${supportEmail}`} className='wrap-anywhere'>
      {supportEmail}
    </a>
  )
}
