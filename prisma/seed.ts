import { randomUUID } from 'node:crypto'
import { hashPassword } from 'better-auth/crypto'
import { prisma } from '../app/db.server.ts'

// Staging asks for its own password first, so seeded educators can share an
// easy one. The seed skips sign-up, so sign-up's minimum length doesn't apply
const PASSWORD = `password`

// The admin is an admin only while `ADMIN_LIST` names its address, as
// `.env.example` does
const EDUCATORS = [
  { name: `Ada Lovelace`, email: `educator@example.com` },
  { name: `Grace Hopper`, email: `admin@example.com` },
]

// Creates the educator already confirmed, because signing up would email the
// address
const seedEducator = async ({
  name,
  email,
}: {
  name: string
  email: string
}) => {
  const id = randomUUID()
  await prisma.educator.upsert({
    where: { email },
    update: { emailVerified: true },
    create: {
      id,
      name,
      email,
      emailVerified: true,
      credentials: {
        create: {
          id: randomUUID(),
          providerId: `credential`,
          accountId: id,
          password: await hashPassword(PASSWORD),
        },
      },
    },
  })
}

for (const educator of EDUCATORS) {
  await seedEducator(educator)
}
await prisma.$disconnect()
