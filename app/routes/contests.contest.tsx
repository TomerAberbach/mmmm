import { Outlet } from 'react-router'
import type { Route } from './+types/contests.contest.ts'
import {
  loadEducatorContest,
  readRequiredContest,
} from '~/contest-context.server.ts'

export const middleware: Route.MiddlewareFunction[] = [loadEducatorContest]

/** Pages below are only for the educator who runs the contest */
export const loader = ({ context }: Route.LoaderArgs) => {
  readRequiredContest(context)
  return null
}

const ContestLayout = () => <Outlet />
export default ContestLayout
