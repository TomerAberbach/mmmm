import { Outlet } from 'react-router'
import type { Route } from './+types/contests.contest.ts'
import {
  loadEducatorContest,
  readViewableContest,
} from '~/contest-context.server.ts'

export const middleware: Route.MiddlewareFunction[] = [loadEducatorContest]

/**
 * Pages below are only for the educator who runs the contest and the colleagues
 * it's shared with
 */
export const loader = ({ context }: Route.LoaderArgs) => {
  readViewableContest(context)
  return null
}

const ContestLayout = () => <Outlet />
export default ContestLayout
