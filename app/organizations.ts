/** The name is null until an educator there gives one */
export type Organization = { domain: string; name: string | null }

/** Its domain until it has a name */
export const describeOrganization = ({ domain, name }: Organization): string =>
  name ?? domain
