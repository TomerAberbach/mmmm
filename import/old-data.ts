import type { PrismaClient } from '../app/generated/prisma/client.ts'

/** The rows of mmmm-old's database that the import reads */
export type OldData = {
  brackets: OldBracket[]
  teachers: OldTeacher[]
  classes: OldClass[]
  submissions: OldSubmission[]
}

export type OldBracket = {
  year: number
  createdAt: Date
  updatedAt: Date
  topLeftDivision: string
  topRightDivision: string
  bottomLeftDivision: string
  bottomRightDivision: string
  winners: string
}

export type OldTeacher = { id: string; email: string; createdAt: Date }

export type OldClass = {
  id: string
  name: string
  bracketYear: number
  teacherId: string
  createdAt: Date
}

export type OldSubmission = {
  id: string
  name: string
  approved: boolean
  winners: string
  classId: string
  createdAt: Date
}

/** Leaves out password hashes, sign-in tokens, and schools */
export const readOldData = async (old: PrismaClient): Promise<OldData> => ({
  brackets: await old.$queryRaw<OldBracket[]>`
    SELECT "year", "createdAt", "updatedAt", "topLeftDivision",
      "topRightDivision", "bottomLeftDivision", "bottomRightDivision", "winners"
    FROM "Bracket" ORDER BY "year"
  `,
  teachers: await old.$queryRaw<OldTeacher[]>`
    SELECT "id", "email", "createdAt" FROM "Teacher" ORDER BY "createdAt", "id"
  `,
  classes: await old.$queryRaw<OldClass[]>`
    SELECT "id", "name", "bracketYear", "teacherId", "createdAt"
    FROM "Class" ORDER BY "createdAt", "id"
  `,
  submissions: await old.$queryRaw<OldSubmission[]>`
    SELECT "id", "name", "approved", "winners", "classId", "createdAt"
    FROM "Submission" ORDER BY "createdAt", "id"
  `,
})
