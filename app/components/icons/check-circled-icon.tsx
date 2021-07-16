import * as React from 'react'

function CheckCircledIcon({
  size = 36,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="18" cy="18" r="18" fill="currentColor" />
      <path
        d="M10.8115 17L16.4214 22.6099L25.0314 14"
        stroke="white"
        strokeWidth="2"
      />
    </svg>
  )
}

export {CheckCircledIcon}
