type Props = {
  width?: string
  height?: string
}

// Skeleton is a placeholder block for content that hasn't loaded yet.
export function Skeleton({ width = '100%', height = '1em' }: Props) {
  return (
    <span className="skeleton" style={{ width, height }} aria-hidden="true" />
  )
}
