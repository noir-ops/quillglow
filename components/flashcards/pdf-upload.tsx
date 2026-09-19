"use client"

import type React from "react"

import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface PDFUploadProps {
  onTextExtracted: (text: string, fileName: string) => void
  disabled?: boolean
}

export function PDFUpload({ onTextExtracted, disabled }: PDFUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (selectedFile: File) => {
    setError(null)
    setSuccess(false)

    if (!selectedFile.name.endsWith(".pdf")) {
      setError("Only PDF files are allowed")
      return
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB")
      return
    }

    setFile(selectedFile)
    extractPdfText(selectedFile)
  }

  const extractPdfText = async (fileToProcess: File) => {
    setUploading(true)
    setProgress(10)

    try {
      // Dynamically import pdfjs-dist
      const pdfjsLib = await import("pdfjs-dist")

      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

      setProgress(30)

      const arrayBuffer = await fileToProcess.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

      setProgress(50)

      let fullText = ""
      const totalPages = pdf.numPages

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map((item: any) => item.str).join(" ")
        fullText += pageText + "\n\n"
        setProgress(50 + Math.round((i / totalPages) * 40))
      }

      if (!fullText.trim()) {
        throw new Error("Could not extract text from PDF. The PDF may be image-based or protected.")
      }

      setProgress(100)
      setSuccess(true)
      onTextExtracted(fullText.trim(), fileToProcess.name)
    } catch (err) {
      console.error("[v0] PDF extraction error:", err)
      setError(err instanceof Error ? err.message : "Failed to process PDF")
      setFile(null)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }

  const clearFile = () => {
    setFile(null)
    setError(null)
    setSuccess(false)
    setProgress(0)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const selectedFile = e.target.files?.[0]
          if (selectedFile) handleFileSelect(selectedFile)
        }}
        disabled={disabled || uploading}
      />

      <AnimatePresence mode="wait">
        {!file ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
              (disabled || uploading) && "opacity-50 cursor-not-allowed",
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !disabled && !uploading && inputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">Drop a PDF here or click to upload</p>
            <p className="text-xs text-muted-foreground mt-1">Max file size: 10MB</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="border rounded-lg p-4 bg-muted/30"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              ) : success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation()
                    clearFile()
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {uploading && (
              <div className="mt-3">
                <Progress value={progress} className="h-1.5" />
                <p className="text-xs text-muted-foreground mt-1">Extracting text from PDF...</p>
              </div>
            )}

            {success && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                PDF text extracted successfully!
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </motion.div>
      )}
    </div>
  )
}
