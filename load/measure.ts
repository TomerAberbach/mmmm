type Measured = { times: number[]; statuses: Map<number, number> }

/** What each kind of request took, in milliseconds, and how it was answered */
export type Measurements = Map<string, Measured>

export const measure = async (
  measurements: Measurements,
  kind: string,
  request: () => Promise<Response>,
): Promise<Response> => {
  const entry: Measured = measurements.get(kind) ?? {
    times: [],
    statuses: new Map(),
  }
  measurements.set(kind, entry)
  const start = performance.now()
  const response = await request()
  await response.arrayBuffer()
  entry.times.push(performance.now() - start)
  entry.statuses.set(
    response.status,
    (entry.statuses.get(response.status) ?? 0) + 1,
  )
  return response
}

export const printMeasurements = (
  title: string,
  measurements: Measurements,
  seconds: number,
): void => {
  console.log(`\n${title}`)
  console.table(
    Object.fromEntries(
      [...measurements].map(([kind, { times, statuses }]) => {
        const sorted = times.toSorted((first, second) => first - second)
        const at = (share: number) =>
          Math.round(sorted[Math.ceil(share * sorted.length) - 1]!)
        return [
          kind,
          {
            requests: times.length,
            'per second': Math.round(times.length / seconds),
            'p50 ms': at(0.5),
            'p95 ms': at(0.95),
            'max ms': at(1),
            statuses: [...statuses]
              .map(([status, count]) => `${status}×${count}`)
              .join(` `),
          },
        ]
      }),
    ),
  )
}
