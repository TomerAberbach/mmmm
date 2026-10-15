import { renderSVG } from 'uqr'

// The quiet zone 4 modules wide is the space scanners need. The data URL keeps
// it one element without an inline <svg>, and the CSP allows data: images
export const QrCode = ({ value, label }: { value: string; label: string }) => (
  <img
    src={`data:image/svg+xml,${encodeURIComponent(renderSVG(value, { border: 4, pixelSize: 1 }))}`}
    alt={label}
    width={224}
    height={224}
    className='size-56 [image-rendering:pixelated]'
  />
)
