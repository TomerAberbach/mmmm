import { auth } from '../app/auth.server.ts'
import { prisma } from '../app/db.server.ts'

const EDUCATOR = {
  name: `Ada Lovelace`,
  email: `educator@example.com`,
  password: `educator-password`,
}

const seedEducator = async () => {
  const existing = await prisma.educator.findUnique({
    where: { email: EDUCATOR.email },
  })
  if (!existing) {
    await auth.api.signUpEmail({ body: EDUCATOR })
  }
}

await seedEducator()
await prisma.$disconnect()
