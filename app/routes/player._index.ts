import { href, redirect } from 'react-router'
import type { Route } from './+types/player._index.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/player/:contestId/bracket`, params))
