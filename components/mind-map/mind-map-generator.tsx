"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Brain,
  Upload,
  Loader2,
  History,
  Trash2,
  ChevronRight,
  Download,
  ArrowLeft,
  Sparkles,
  FileText,
  Network,
  Type,
  FileUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { PDFUpload } from "@/components/flashcards/pdf-upload"
import { MindMapViewer, type MindMapNode } from "./mind-map-viewer"

interface SavedMindMap {
  id: string
  title: string
  subject: string
  source_type: string
  created_at: string
}

interface MindMapData {
  root: MindMapNode
}

export function MindMapGenerator() {
  const [inputMode, setInputMode] = useState<"pdf" | "text">("text")
  const [extractedText, setExtractedText] = useState("")
  const [pdfFileName, setPdfFileName] = useState<string | null>(null)
  const [manualText, setManualText] = useState("")
  const [topic, setTopic] = useState("")
  const [depth, setDepth] = useState(3)
  const [loading, setLoading] = useState(false)
  const [mindMapData, setMindMapData] = useState<MindMapData | null>(null)
  const [mindMapTitle, setMindMapTitle] = useState("")
  const [mindMapId, setMindMapId] = useState<string | null>(null)
  const [savedMaps, setSavedMaps] = useState<SavedMindMap[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingMap, setLoadingMap] = useState(false)

  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
      const response = await fetch("/api/mind-map")
      if (response.ok) {
        const data = await response.json()
        setSavedMaps(data)
      }
    } catch (error) {
      console.error("Failed to fetch mind maps:", error)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  const getSourceText = () => {
    return inputMode === "pdf" ? extractedText : manualText
  }

  const handleGenerate = async () => {
    const sourceText = getSourceText()
    if (!sourceText) {
      toast.error(inputMode === "pdf" ? "Please upload a document first" : "Please enter some text")
      return
    }
    if (!topic.trim()) {
      toast.error("Please enter a topic")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/mind-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentText: sourceText,
          topic: topic.trim(),
          depth,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to generate mind map")
      }

      const data = await response.json()
      setMindMapData(data.map_data)
      setMindMapTitle(data.title)
      setMindMapId(data.id)
      toast.success("Mind map generated!")
      fetchHistory()
    } catch (error) {
      console.error("Error generating mind map:", error)
      toast.error(error instanceof Error ? error.message : "Failed to generate mind map")
    } finally {
      setLoading(false)
    }
  }

  const handleLoadMap = async (id: string) => {
    setLoadingMap(true)
    try {
      const response = await fetch(`/api/mind-map?id=${id}`)
      if (response.ok) {
        const data = await response.json()
        setMindMapData(data.map_data)
        setMindMapTitle(data.title)
        setMindMapId(data.id)
        setShowHistory(false)
      } else {
        toast.error("Failed to load mind map")
      }
    } catch (error) {
      console.error("Error loading mind map:", error)
      toast.error("Failed to load mind map")
    } finally {
      setLoadingMap(false)
    }
  }

  const handleDeleteMap = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Delete this mind map?")) return

    try {
      const response = await fetch(`/api/mind-map?id=${id}`, { method: "DELETE" })
      if (response.ok) {
        toast.success("Mind map deleted")
        setSavedMaps((prev) => prev.filter((m) => m.id !== id))
        if (mindMapId === id) {
          setMindMapData(null)
          setMindMapId(null)
        }
      }
    } catch {
      toast.error("Failed to delete mind map")
    }
  }

  const handleExportPDF = async () => {
    if (!mindMapData) return
    
    toast.info("Generating PDF...")
    
    // Use browser print functionality with custom styling
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      toast.error("Please allow popups to export PDF")
      return
    }

    // Build HTML content for the mind map
    const buildNodeHTML = (node: MindMapNode, depth = 0, colorIdx = 0): string => {
      const colors = [
        { bg: "#dbeafe", border: "#3b82f6", text: "#1d4ed8" },
        { bg: "#d1fae5", border: "#10b981", text: "#047857" },
        { bg: "#fef3c7", border: "#f59e0b", text: "#b45309" },
        { bg: "#ede9fe", border: "#8b5cf6", text: "#6d28d9" },
        { bg: "#ffe4e6", border: "#f43f5e", text: "#be123c" },
        { bg: "#cffafe", border: "#06b6d4", text: "#0e7490" },
      ]
      const color = colors[colorIdx % colors.length]
      
      const isRoot = depth === 0
      const hasChildren = node.children && node.children.length > 0
      
      let html = `
        <div style="margin-left: ${depth * 24}px; margin-bottom: 8px;">
          <div style="
            padding: ${isRoot ? "12px 16px" : "8px 12px"};
            border-radius: 8px;
            border: 2px solid ${isRoot ? "#6366f1" : color.border};
            background: ${isRoot ? "#6366f1" : color.bg};
            color: ${isRoot ? "white" : color.text};
            font-weight: ${isRoot ? "bold" : depth === 1 ? "600" : "normal"};
            font-size: ${isRoot ? "18px" : depth === 1 ? "14px" : "13px"};
            display: inline-block;
            max-width: 100%;
          ">
            ${node.label}
          </div>
          ${node.description ? `<div style="margin-left: 8px; margin-top: 4px; font-size: 11px; color: #6b7280; max-width: 500px;">${node.description}</div>` : ""}
        </div>
      `
      
      if (hasChildren) {
        node.children!.forEach((child, idx) => {
          html += buildNodeHTML(child, depth + 1, depth === 0 ? idx : colorIdx)
        })
      }
      
      return html
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${mindMapTitle} - Mind Map</title>
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              padding: 40px;
              max-width: 900px;
              margin: 0 auto;
              background: white;
            }
            h1 {
              color: #1f2937;
              border-bottom: 3px solid #6366f1;
              padding-bottom: 12px;
              margin-bottom: 24px;
            }
            .subtitle {
              color: #6b7280;
              font-size: 14px;
              margin-bottom: 32px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 16px;
              border-top: 1px solid #e5e7eb;
              color: #9ca3af;
              font-size: 12px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <h1>${mindMapTitle}</h1>
          <div class="subtitle">Generated by QuillGlow Mind Map</div>
          ${buildNodeHTML(mindMapData.root)}
          <div class="footer">
            Exported on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
          </div>
        </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()
    
    setTimeout(() => {
      printWindow.print()
    }, 500)
    
    toast.success("PDF export ready - use Print dialog to save")
  }

  const handleBack = () => {
    setMindMapData(null)
    setMindMapId(null)
  }

  // If viewing a mind map
  if (mindMapData) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between gap-4 p-4 border-b">
          <Button variant="outline" size="sm" onClick={handleBack} className="gap-2 bg-transparent">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2 bg-transparent">
              <Download className="h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <MindMapViewer data={mindMapData} title={mindMapTitle} />
        </div>
      </div>
    )
  }

  const sourceText = getSourceText()

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            AI Mind Map Generator
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Transform your study materials into visual knowledge maps
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowHistory(!showHistory)
            if (!showHistory) fetchHistory()
          }}
          className="gap-2 bg-transparent"
        >
          <History className="h-4 w-4" />
          {showHistory ? "Hide" : "Show"} History
        </Button>
      </div>

      {/* History Section */}
      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Saved Mind Maps
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : savedMaps.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No mind maps yet. Create your first one!</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {savedMaps.map((map) => (
                      <button
                        key={map.id}
                        onClick={() => handleLoadMap(map.id)}
                        disabled={loadingMap}
                        className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <Network className="h-5 w-5 text-primary" />
                          <div>
                            <p className="font-medium text-sm">{map.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(map.created_at).toLocaleDateString()} | {map.source_type === "pdf" ? "From PDF" : map.source_type === "text" ? "From Text" : "From Notes"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => handleDeleteMap(map.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Section with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Add Study Material
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "pdf" | "text")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text" className="gap-2">
                <Type className="h-4 w-4" />
                Paste Text
              </TabsTrigger>
              <TabsTrigger value="pdf" className="gap-2">
                <FileUp className="h-4 w-4" />
                Upload PDF
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="text" className="mt-4">
              <div className="space-y-2">
                <Label>Enter or paste your study material</Label>
                <Textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Paste your notes, articles, or any text content here...

Example: 
Photosynthesis is the process by which plants convert light energy into chemical energy. This process occurs in the chloroplasts of plant cells and involves two main stages: the light-dependent reactions and the Calvin cycle..."
                  className="min-h-[200px] resize-y"
                  disabled={loading}
                />
                {manualText && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Type className="h-4 w-4" />
                    <span>{manualText.length.toLocaleString()} characters</span>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="pdf" className="mt-4">
              <PDFUpload
                onTextExtracted={(text, filename) => {
                  setExtractedText(text)
                  setPdfFileName(filename)
                }}
                disabled={loading}
              />
              {pdfFileName && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
                  <FileText className="h-4 w-4" />
                  <span>{pdfFileName}</span>
                  <Badge variant="secondary">{extractedText.length.toLocaleString()} chars</Badge>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Configuration Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Configure Mind Map
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="topic">Topic / Subject</Label>
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Cell Biology, World War II, JavaScript Functions"
              disabled={loading}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Depth Level</Label>
              <Badge variant="outline">{depth} levels</Badge>
            </div>
            <Slider
              value={[depth]}
              onValueChange={([v]) => setDepth(v)}
              min={2}
              max={5}
              step={1}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Higher depth creates more detailed hierarchies. Recommended: 3-4 for most topics.
            </p>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading || !sourceText || !topic.trim()}
            className="w-full gap-2"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Mind Map...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4" />
                Generate Mind Map
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Features Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <Network className="h-8 w-8 text-blue-600 dark:text-blue-400 mb-3" />
            <h4 className="font-medium mb-1">Visual Hierarchy</h4>
            <p className="text-sm text-muted-foreground">
              Automatically organizes concepts into logical branches with color-coded themes
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-200 dark:border-purple-800">
          <CardContent className="pt-6">
            <Sparkles className="h-8 w-8 text-purple-600 dark:text-purple-400 mb-3" />
            <h4 className="font-medium mb-1">AI-Powered Analysis</h4>
            <p className="text-sm text-muted-foreground">
              Extracts key concepts and relationships from your study materials
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-200 dark:border-emerald-800">
          <CardContent className="pt-6">
            <Download className="h-8 w-8 text-emerald-600 dark:text-emerald-400 mb-3" />
            <h4 className="font-medium mb-1">Export as PDF</h4>
            <p className="text-sm text-muted-foreground">
              Download your mind maps as PDFs for printing or sharing
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
