'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, BASE_URL } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Loader2, Share2, Info, Download } from 'lucide-react'
import { formatBytes } from '@/lib/utils'

interface Node {
  id: string
  label: string
  type: 'file' | 'folder' | 'tag'
  mime?: string | null
  size?: number
  color?: string
}

interface Link {
  source: string
  target: string
  value: number
}

interface AssociationData {
  nodes: Node[]
  links: Link[]
}

export function AssociationMap() {
  const { data, isLoading } = useQuery({
    queryKey: ['files', 'associations'],
    queryFn: () => api.get<{ data: AssociationData }>('/v1/files/associations'),
  })

  const [hoveredNode, setHoveredNode] = useState<Node | null>(null)
  const [activeNode, setActiveNode] = useState<Node | null>(null)

  if (isLoading) {
    return (
      <div className="h-60 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
          <span className="text-xs">Mapping celestial file constellations...</span>
        </div>
      </div>
    )
  }

  const graph = data?.data ?? { nodes: [], links: [] }

  // Simple layout calculation to space out nodes in a clean circle/network layout
  const nodes = [...graph.nodes]
  const links = [...graph.links]

  const width = 1000
  const height = 360
  const centerX = width / 2
  const centerY = height / 2

  // Position nodes dynamically
  const nodePositions: Record<string, { x: number; y: number }> = {}

  // 1. Position folder nodes in the center row
  const folders = nodes.filter((n) => n.type === 'folder')
  folders.forEach((folder, idx) => {
    const total = folders.length
    const x = total === 1 ? centerX : centerX + (idx - (total - 1) / 2) * 280
    nodePositions[folder.id] = { x, y: centerY }
  })

  // 2. Position tag nodes in a circle around the center
  const tags = nodes.filter((n) => n.type === 'tag')
  tags.forEach((tag, idx) => {
    const angle = (idx / tags.length) * 2 * Math.PI
    const radius = 120
    const x = centerX + radius * Math.cos(angle)
    const y = centerY + radius * Math.sin(angle)
    nodePositions[tag.id] = { x, y }
  })

  // 3. Position files around their respective parent folders or tags
  const files = nodes.filter((n) => n.type === 'file')
  files.forEach((file, idx) => {
    // Find folder or tag link
    const fileLinks = links.filter((l) => l.source === file.id)
    const parentId = fileLinks[0]?.target

    if (parentId && nodePositions[parentId]) {
      const parentPos = nodePositions[parentId]
      const angle = (idx / files.length) * 2 * Math.PI + (idx * 0.5)
      const radius = 65 + (idx % 3) * 20
      const x = parentPos.x + radius * Math.cos(angle)
      const y = parentPos.y + radius * Math.sin(angle)
      nodePositions[file.id] = { x, y }
    } else {
      // Free floating nodes
      const angle = (idx / files.length) * 2 * Math.PI
      const radius = 135
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      nodePositions[file.id] = { x, y }
    }
  })

  // Ensure all nodes have fallback positions
  nodes.forEach((node, idx) => {
    if (!nodePositions[node.id]) {
      const angle = (idx / nodes.length) * 2 * Math.PI
      nodePositions[node.id] = { x: centerX + 180 * Math.cos(angle), y: centerY + 110 * Math.sin(angle) }
    }
  })

  const activeLinks = hoveredNode
    ? links.filter((l) => l.source === hoveredNode.id || l.target === hoveredNode.id)
    : []

  const isConnected = (nodeId: string) => {
    if (!hoveredNode) return false
    if (nodeId === hoveredNode.id) return true
    return activeLinks.some((l) => l.source === nodeId || l.target === nodeId)
  }

  const handleDownload = (file: Node) => {
    if (file.type !== 'file') return
    const { accessToken } = useAuthStore.getState()
    const a = document.createElement('a')
    a.href = `${BASE_URL}/v1/files/${file.id}/download?token=${accessToken}`
    a.download = file.label
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (nodes.length === 0) {
    return (
      <div className="h-44 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
        <Share2 className="w-8 h-8 text-gray-500 mb-2 opacity-40 animate-pulse" />
        <p className="text-sm font-medium text-gray-400">WebVerse Constellation Map</p>
        <p className="text-xs text-gray-600 mt-1 max-w-xs">Upload your first files and watch them dynamically cluster and form glowing relationship chains here!</p>
      </div>
    )
  }

  return (
    <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-surface-100/50 to-surface-200/50 backdrop-blur-xl p-4 overflow-hidden">
      {/* Header Info */}
      <div className="absolute top-4 left-4 flex items-center gap-1.5 text-xs text-gray-400 font-medium">
        <Info className="w-3.5 h-3.5 text-brand-400" />
        <span>Hover over file nodes to explore AI constellations & download</span>
      </div>

      {/* SVG Network Map */}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-80 select-none">
        <defs>
          <radialGradient id="folderGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="tagGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Links / Constellation Lines */}
        {links.map((link, idx) => {
          const sourcePos = nodePositions[link.source]
          const targetPos = nodePositions[link.target]
          if (!sourcePos || !targetPos) return null

          const isHovered = isConnected(link.source) && isConnected(link.target)

          return (
            <line
              key={idx}
              x1={sourcePos.x}
              y1={sourcePos.y}
              x2={targetPos.x}
              y2={targetPos.y}
              stroke={isHovered ? '#818cf8' : 'rgba(255, 255, 255, 0.18)'}
              strokeWidth={isHovered ? 2.0 : 1.0}
              strokeDasharray={link.value === 1 ? '4 2' : undefined}
              className="transition-all duration-300"
            />
          )
        })}

        {/* Node Circles and Elements */}
        {nodes.map((node) => {
          const pos = nodePositions[node.id]
          if (!pos) return null

          const isHovered = hoveredNode?.id === node.id
          const isLinked = isConnected(node.id)
          const isDimmed = hoveredNode && !isHovered && !isLinked

          // Determine node radius and design
          let r = 9
          let fill = '#a1a1aa'
          let glow = null

          if (node.type === 'folder') {
            r = 24
            fill = '#8b5cf6'
            glow = <circle cx={pos.x} cy={pos.y} r={56} fill="url(#folderGlow)" />
          } else if (node.type === 'tag') {
            r = 14
            fill = '#14b8a6'
            glow = <circle cx={pos.x} cy={pos.y} r={40} fill="url(#tagGlow)" />
          } else if (node.type === 'file') {
            r = 9
            fill = isHovered ? '#818cf8' : '#38bdf8'
          }

          return (
            <g
              key={node.id}
              transform={`translate(0, 0)`}
              className="cursor-pointer transition-all duration-300"
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => {
                if (node.type === 'file') {
                  handleDownload(node)
                } else {
                  setActiveNode(node)
                }
              }}
              style={{ opacity: isDimmed ? 0.25 : 1 }}
            >
              {/* Glow filter underlay */}
              {glow}

              {/* Node Outer Ring */}
              {(isHovered || isLinked) && (
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={r + 8}
                  fill="none"
                  stroke={node.type === 'tag' ? '#2dd4bf' : '#818cf8'}
                  strokeWidth={1.5}
                  className="animate-pulse"
                />
              )}

              {/* Central Node Circle */}
              <circle cx={pos.x} cy={pos.y} r={r} fill={fill} />

              {/* Glowing star visual for files */}
              {node.type === 'file' && isHovered && (
                <polygon
                  points={`${pos.x},${pos.y - 18} ${pos.x + 5},${pos.y - 5} ${pos.x + 18},${pos.y} ${pos.x + 5},${pos.y + 5} ${pos.x},${pos.y + 18} ${pos.x - 5},${pos.y + 5} ${pos.x - 18},${pos.y} ${pos.x - 5},${pos.y - 5}`}
                  fill="#60a5fa"
                  opacity={0.3}
                />
              )}

              {/* Text Label */}
              <text
                x={pos.x}
                y={pos.y + r + 13}
                textAnchor="middle"
                fill={isHovered || isLinked ? '#ffffff' : '#9ca3af'}
                fontSize={node.type === 'folder' ? '11px' : '9.5px'}
                fontWeight={node.type === 'folder' || isHovered ? 'bold' : 'normal'}
                className="pointer-events-none transition-all duration-300 font-sans tracking-wide"
                opacity={isDimmed ? 0.15 : 1}
              >
                {node.label.length > 15 ? `${node.label.slice(0, 12)}...` : node.label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Floating Interactive Tooltip */}
      {hoveredNode && (
        <div
          className="absolute bottom-4 right-4 max-w-xs p-3 rounded-xl border border-white/10 bg-black/40 backdrop-blur-md text-xs space-y-1.5 animate-fade-in shadow-2xl transition-all duration-300"
        >
          <div className="flex items-center justify-between gap-4">
            <span className="font-bold text-white truncate max-w-[160px]">{hoveredNode.label}</span>
            <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] uppercase tracking-wider text-gray-400">
              {hoveredNode.type}
            </span>
          </div>

          {hoveredNode.type === 'file' && (
            <div className="flex flex-col gap-1 text-[10px] text-gray-400">
              {hoveredNode.size && <span>Size: {formatBytes(hoveredNode.size)}</span>}
              {hoveredNode.mime && <span className="truncate">Type: {hoveredNode.mime}</span>}
              <div className="flex items-center gap-1.5 pt-1.5 border-t border-white/5 mt-1 text-brand-400 font-semibold animate-pulse">
                <Download className="w-3 h-3" />
                <span>Click node to download</span>
              </div>
            </div>
          )}

          {hoveredNode.type === 'folder' && (
            <div className="text-[10px] text-gray-400">
              <span>Virtual Folder Directory</span>
            </div>
          )}

          {hoveredNode.type === 'tag' && (
            <div className="text-[10px] text-gray-400">
              <span>AI Constellation Categorization Node</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
