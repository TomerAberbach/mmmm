import { prisma } from '~/db.server.ts'
import { checkDatabase } from '~/health.server.ts'

export const loader = async (): Promise<Response> => {
  const database = await checkDatabase(prisma)
  return Response.json({ database }, { status: database === `up` ? 200 : 503 })
}
