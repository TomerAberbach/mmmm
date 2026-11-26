import { href } from 'react-router'
import type { Route } from './+types/play.deleted.ts'
import { DeletedOwnBracket } from '~/components/removed.tsx'

const DeletedPage = ({ params }: Route.ComponentProps) => (
  <DeletedOwnBracket contestPath={href(`/play/:linkSecret`, params)} />
)
export default DeletedPage
