"use client"

import { toast as sonnerToast } from "sonner"

/**
 * useToast — same API the app already calls, delivered through sonner.
 *
 * This hook originally drove a Radix-based toast (components/ui/toast.tsx),
 * but @radix-ui/react-toast was never installed and no toast container was
 * ever mounted, so all 33 calls to it (search, study rooms, tutor settings)
 * silently did nothing. Rather than add a dependency, calls are forwarded to
 * sonner, which is installed and mounted once in app/layout.tsx.
 *
 * Supports exactly what the codebase uses: { title, description, variant }.
 */
export interface ToastOptions {
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

export function toast({ title, description, variant }: ToastOptions) {
  const message = title ?? description ?? ""
  const opts = title && description ? { description } : undefined
  return variant === "destructive" ? sonnerToast.error(message, opts) : sonnerToast(message, opts)
}

export function useToast() {
  return {
    toast,
    dismiss: (id?: string | number) => sonnerToast.dismiss(id),
    toasts: [] as never[],
  }
}
