'use client'

// Mini gráfica de línea SVG, sin dependencias.
export default function Sparkline({
  points,
  width = 64,
  height = 24,
  color = '#48bb78',
  strokeWidth = 1.5,
  responsive = false,
}: {
  points: number[]
  width?: number
  height?: number
  color?: string
  strokeWidth?: number
  responsive?: boolean // estira al ancho del contenedor (stroke se mantiene crisp)
}) {
  if (!points || points.length < 2) {
    return <div style={{ width: responsive ? '100%' : width, height }} />
  }

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const n = points.length

  const coords = points.map((p, i) => {
    const x = (i / (n - 1)) * width
    const y = height - ((p - min) / range) * (height - strokeWidth * 2) - strokeWidth
    return [x, y] as const
  })

  const d = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const areaD = `${d} L${width},${height} L0,${height} Z`
  const gid = `spark-${color.replace('#', '')}-${width}-${height}`

  return (
    <svg
      width={responsive ? '100%' : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={responsive ? 'none' : 'xMidYMid meet'}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gid})`} stroke="none" />
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect={responsive ? 'non-scaling-stroke' : undefined} />
    </svg>
  )
}
