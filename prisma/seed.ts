import { randomUUID } from 'node:crypto'
import { hashPassword } from 'better-auth/crypto'
import { prisma } from '../app/db.server.ts'

const EDUCATOR = {
  name: `Ada Lovelace`,
  email: `educator@example.com`,
  // Staging asks for its own password first, so seeded educators can share an
  // easy one. The seed skips sign-up, so sign-up's minimum length doesn't apply
  password: `password`,
}

// Creates the educator already confirmed, because signing up would email the
// address
const seedEducator = async () => {
  const id = randomUUID()
  await prisma.educator.upsert({
    where: { email: EDUCATOR.email },
    update: { emailVerified: true },
    create: {
      id,
      name: EDUCATOR.name,
      email: EDUCATOR.email,
      emailVerified: true,
      credentials: {
        create: {
          id: randomUUID(),
          providerId: `credential`,
          accountId: id,
          password: await hashPassword(EDUCATOR.password),
        },
      },
    },
  })
}

await seedEducator()
await prisma.$disconnect()
