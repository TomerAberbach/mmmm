// Shows one of `labels`. Every label shares one grid cell, so the element keeps
// the widest one's width as the shown label changes
export const StableLabel = ({
  labels,
  shown,
}: {
  labels: string[]
  shown: string
}) => (
  <span className='inline-grid'>
    {labels.map(label => (
      <span
        key={label}
        className={`col-start-1 row-start-1 whitespace-nowrap ${label === shown ? `` : `invisible`}`}
      >
        {label}
      </span>
    ))}
  </span>
)
