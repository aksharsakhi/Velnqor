import React from 'react'

interface VelnqorLogoProps {
  className?: string
  size?: number
}

/**
 * Clean, modern, minimalist SVG logo for Velnqor.
 * Handcrafted vector geometry with vibrant emerald-to-cyan gradient.
 */
export function VelnqorLogo({
  className = 'h-5.5 w-5.5',
  size
}: VelnqorLogoProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient
          id="velnqorLogoGrad"
          x1="120"
          y1="140"
          x2="392"
          y2="390"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      {/* Sleek rounded squircle container */}
      <rect width="512" height="512" rx="116" fill="#0D1117" />
      <rect
        x="1.5"
        y="1.5"
        width="509"
        height="509"
        rx="114.5"
        fill="none"
        stroke="rgba(255, 255, 255, 0.08)"
        strokeWidth="3"
      />
      {/* Bold, clean V monogram */}
      <path
        d="M124 146 L256 386 L388 146"
        stroke="url(#velnqorLogoGrad)"
        strokeWidth="56"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
