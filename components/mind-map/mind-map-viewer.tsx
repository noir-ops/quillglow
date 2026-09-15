"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ChevronDown, 
  ChevronRight,
  Focus,
  RotateCcw,
  Info,
  Maximize2,
  Layers,
  Circle,
  ZoomIn,
  ZoomOut,
  Move
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface MindMapNode {
  id: string
  label: string
  description?: string
  children?: MindMapNode[]
}

interface MindMapData {
  root: MindMapNode
}

interface MindMapViewerProps {
  data: MindMapData
  title?: string
  onNodeClick?: (node: MindMapNode) => void
}

// Color palette for branches
const branchColors = [
  { stroke: "#3b82f6", fill: "#dbeafe", text: "#1e40af", glow: "rgba(59, 130, 246, 0.3)" },
  { stroke: "#10b981", fill: "#d1fae5", text: "#065f46", glow: "rgba(16, 185, 129, 0.3)" },
  { stroke: "#f59e0b", fill: "#fef3c7", text: "#92400e", glow: "rgba(245, 158, 11, 0.3)" },
  { stroke: "#8b5cf6", fill: "#ede9fe", text: "#5b21b6", glow: "rgba(139, 92, 246, 0.3)" },
  { stroke: "#f43f5e", fill: "#ffe4e6", text: "#9f1239", glow: "rgba(244, 63, 94, 0.3)" },
  { stroke: "#06b6d4", fill: "#cffafe", text: "#0e7490", glow: "rgba(6, 182, 212, 0.3)" },
  { stroke: "#f97316", fill: "#ffedd5", text: "#c2410c", glow: "rgba(249, 115, 22, 0.3)" },
  { stroke: "#6366f1", fill: "#e0e7ff", text: "#3730a3", glow: "rgba(99, 102, 241, 0.3)" },
]

interface NodePosition {
  x: number
  y: number
  node: MindMapNode
  colorIndex: number
  depth: number
  parent?: NodePosition
}

// Calculate tree layout positions
function calculateTreeLayout(
  root: MindMapNode,
  expandedNodes: Set<string>,
  nodeWidth: number,
  nodeHeight: number,
  levelGap: number,
  siblingGap: number
): NodePosition[] {
  const positions: NodePosition[] = []
  
  function calculateSubtreeWidth(node: MindMapNode, depth: number): number {
    if (!node.children || node.children.length === 0 || !expandedNodes.has(node.id)) {
      return nodeWidth
    }
    const childrenWidth = node.children.reduce((sum, child) => 
      sum + calculateSubtreeWidth(child, depth + 1) + siblingGap, -siblingGap)
    return Math.max(nodeWidth, childrenWidth)
  }
  
  function positionNodes(
    node: MindMapNode,
    x: number,
    y: number,
    colorIndex: number,
    depth: number,
    parent?: NodePosition
  ): number {
    const position: NodePosition = { x, y, node, colorIndex, depth, parent }
    positions.push(position)
    
    if (!node.children || node.children.length === 0 || !expandedNodes.has(node.id)) {
      return nodeWidth
    }
    
    let currentX = x
    const totalWidth = calculateSubtreeWidth(node, depth)
    const startX = x + (nodeWidth - totalWidth) / 2
    currentX = startX
    
    node.children.forEach((child, idx) => {
      const childColorIndex = depth === 0 ? idx : colorIndex
      const childWidth = calculateSubtreeWidth(child, depth + 1)
      const childX = currentX + childWidth / 2 - nodeWidth / 2
      positionNodes(child, childX, y + levelGap, childColorIndex, depth + 1, position)
      currentX += childWidth + siblingGap
    })
    
    return totalWidth
  }
  
  const rootWidth = calculateSubtreeWidth(root, 0)
  positionNodes(root, rootWidth / 2 - nodeWidth / 2, 50, 0, 0)
  
  return positions
}

// SVG curved line path between nodes
function getCurvedPath(from: NodePosition, to: NodePosition, nodeWidth: number, nodeHeight: number): string {
  const x1 = from.x + nodeWidth / 2
  const y1 = from.y + nodeHeight
  const x2 = to.x + nodeWidth / 2
  const y2 = to.y
  
  const midY = (y1 + y2) / 2
  const controlOffset = Math.abs(x2 - x1) * 0.2
  
  return `M ${x1} ${y1} C ${x1} ${midY + controlOffset}, ${x2} ${midY - controlOffset}, ${x2} ${y2}`
}

export function MindMapViewer({ data, title, onNodeClick }: MindMapViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    initial.add(data.root.id)
    data.root.children?.forEach(child => initial.add(child.id))
    return initial
  })
  const [focusedNode, setFocusedNode] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  
  // Responsive sizing
  const nodeWidth = 200
  const nodeHeight = 60
  const levelGap = 120
  const siblingGap = 30
  
  const positions = calculateTreeLayout(data.root, expandedNodes, nodeWidth, nodeHeight, levelGap, siblingGap)
  
  // Calculate canvas size
  const minX = Math.min(...positions.map(p => p.x)) - 50
  const maxX = Math.max(...positions.map(p => p.x)) + nodeWidth + 50
  const maxY = Math.max(...positions.map(p => p.y)) + nodeHeight + 100
  const canvasWidth = maxX - minX
  const canvasHeight = maxY
  
  const toggleNode = useCallback((id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])
  
  const expandAll = useCallback(() => {
    const allIds = new Set<string>()
    const collectIds = (node: MindMapNode) => {
      allIds.add(node.id)
      node.children?.forEach(collectIds)
    }
    collectIds(data.root)
    setExpandedNodes(allIds)
  }, [data.root])
  
  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set([data.root.id]))
  }, [data.root.id])
  
  const handleNodeClick = useCallback((node: MindMapNode) => {
    setSelectedNode(node)
    onNodeClick?.(node)
  }, [onNodeClick])
  
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 2))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.3))
  const handleResetView = () => { setZoom(1); setPan({ x: 0, y: 0 }) }
  
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
    }
  }
  
  const handleMouseUp = () => setIsDragging(false)
  
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom(prev => Math.max(0.3, Math.min(2, prev + delta)))
    }
  }
  
  // Count nodes
  const countNodes = (node: MindMapNode): number => {
    let count = 1
    if (node.children) {
      for (const child of node.children) {
        count += countNodes(child)
      }
    }
    return count
  }
  const totalNodes = countNodes(data.root)
  const branchCount = data.root.children?.length || 0
  
  // Center view on mount
  useEffect(() => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth
      const offsetX = (containerWidth - canvasWidth * zoom) / 2
      setPan(prev => ({ ...prev, x: Math.max(0, offsetX) }))
    }
  }, [])
  
  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div>
          {title && <h3 className="font-bold text-lg">{title}</h3>}
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" />
              {totalNodes} nodes
            </span>
            <span className="flex items-center gap-1">
              <Circle className="h-3 w-3" />
              {branchCount} branches
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleResetView} className="gap-1.5 bg-transparent">
            <Move className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={expandAll} className="gap-1.5 bg-transparent">
            <Maximize2 className="h-4 w-4" />
            <span className="hidden sm:inline">Expand</span>
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll} className="gap-1.5 bg-transparent">
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Collapse</span>
          </Button>
        </div>
      </div>
      
      {/* Mind Map Canvas */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div 
          style={{ 
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'top left',
            width: canvasWidth,
            height: canvasHeight,
            position: 'relative',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
        >
          {/* SVG Layer for Connections */}
          <svg 
            width={canvasWidth} 
            height={canvasHeight}
            style={{ position: 'absolute', top: 0, left: -minX, pointerEvents: 'none' }}
          >
            <defs>
              {branchColors.map((color, i) => (
                <linearGradient key={i} id={`gradient-${i}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={color.stroke} stopOpacity="0.8" />
                  <stop offset="100%" stopColor={color.stroke} stopOpacity="0.4" />
                </linearGradient>
              ))}
              <filter id="glow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            {/* Connection Lines */}
            {positions.filter(p => p.parent).map((pos, i) => {
              const color = branchColors[pos.colorIndex % branchColors.length]
              return (
                <motion.path
                  key={`line-${i}`}
                  d={getCurvedPath(pos.parent!, pos, nodeWidth, nodeHeight)}
                  fill="none"
                  stroke={`url(#gradient-${pos.colorIndex % branchColors.length})`}
                  strokeWidth={pos.depth === 1 ? 4 : pos.depth === 2 ? 3 : 2}
                  strokeLinecap="round"
                  filter="url(#glow)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: pos.depth * 0.1 }}
                />
              )
            })}
          </svg>
          
          {/* Node Layer */}
          {positions.map((pos, i) => {
            const { node, x, y, colorIndex, depth } = pos
            const color = branchColors[colorIndex % branchColors.length]
            const hasChildren = node.children && node.children.length > 0
            const isExpanded = expandedNodes.has(node.id)
            const isFocused = focusedNode === node.id
            const isRoot = depth === 0
            
            return (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, scale: 0.8, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.3, delay: depth * 0.08 + i * 0.02 }}
                style={{
                  position: 'absolute',
                  left: x - minX,
                  top: y,
                  width: nodeWidth,
                  zIndex: isFocused ? 100 : 10 - depth
                }}
                className="group"
              >
                <div
                  className={cn(
                    "relative rounded-2xl p-3 cursor-pointer transition-all duration-200",
                    "border-2 shadow-lg hover:shadow-xl",
                    isFocused && "ring-4 ring-primary/50"
                  )}
                  style={{
                    background: isRoot 
                      ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' 
                      : color.fill,
                    borderColor: isRoot ? '#4f46e5' : color.stroke,
                    boxShadow: isRoot 
                      ? `0 8px 32px rgba(99, 102, 241, 0.3), 0 0 0 1px rgba(255,255,255,0.1) inset`
                      : `0 4px 20px ${color.glow}`,
                  }}
                  onClick={() => {
                    if (hasChildren) toggleNode(node.id)
                    handleNodeClick(node)
                  }}
                >
                  {/* Expand indicator */}
                  {hasChildren && (
                    <button
                      className={cn(
                        "absolute -bottom-3 left-1/2 -translate-x-1/2 z-20",
                        "w-6 h-6 rounded-full flex items-center justify-center",
                        "border-2 transition-all shadow-md",
                        isRoot 
                          ? "bg-white text-indigo-600 border-indigo-300 hover:bg-indigo-50" 
                          : "bg-white border-current hover:scale-110"
                      )}
                      style={{ color: isRoot ? undefined : color.stroke, borderColor: isRoot ? undefined : color.stroke }}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleNode(node.id)
                      }}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                  
                  {/* Node content */}
                  <div className="text-center">
                    <p 
                      className={cn(
                        "font-bold leading-tight line-clamp-2",
                        isRoot ? "text-white text-base" : "text-sm"
                      )}
                      style={{ color: isRoot ? undefined : color.text }}
                    >
                      {node.label}
                    </p>
                    
                    {hasChildren && (
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          "mt-1.5 text-[10px] px-1.5 py-0",
                          isRoot && "bg-white/20 text-white border-white/30"
                        )}
                      >
                        {node.children!.length} items
                      </Badge>
                    )}
                  </div>
                  
                  {/* Focus button */}
                  <button
                    className={cn(
                      "absolute -top-2 -right-2 opacity-0 group-hover:opacity-100",
                      "w-6 h-6 rounded-full bg-white shadow-md border",
                      "flex items-center justify-center transition-all hover:scale-110"
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      setFocusedNode(isFocused ? null : node.id)
                    }}
                    title={isFocused ? "Unfocus" : "Focus on this node"}
                  >
                    <Focus className="h-3 w-3 text-slate-600" />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
      
      {/* Selected Node Detail Panel */}
      <AnimatePresence>
        {selectedNode && selectedNode.description && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="border-t bg-gradient-to-r from-primary/5 to-primary/10 p-4"
          >
            <div className="flex items-start gap-3 max-w-4xl mx-auto">
              <div className="p-2 rounded-lg bg-primary/10">
                <Info className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{selectedNode.label}</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{selectedNode.description}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedNode(null)}
                className="shrink-0"
              >
                Close
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
