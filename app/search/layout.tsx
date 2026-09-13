import type React from "react"
import { AppLayout } from "@/components/dashboard/app-layout"

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
