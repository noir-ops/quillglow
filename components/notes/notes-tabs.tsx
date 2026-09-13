"use client"

import type React from "react"
import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, BookOpenCheck } from "lucide-react"

/**
 * Client tab shell for the merged Revision & Notes page. The page itself stays
 * a server component so note fetching is unchanged; only the tab switching is
 * client-side.
 */
export function NotesTabs({
  defaultTab,
  notesPanel,
  revisionPanel,
}: {
  defaultTab: string
  notesPanel: React.ReactNode
  revisionPanel: React.ReactNode
}) {
  const [tab, setTab] = useState(defaultTab)

  return (
    <Tabs value={tab} onValueChange={setTab} className="w-full">
      <div className="px-4 pt-4 md:px-6">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="notes" className="gap-2">
            <FileText className="h-4 w-4" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="revision" className="gap-2">
            <BookOpenCheck className="h-4 w-4" />
            Revision
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="notes" className="mt-2">
        {notesPanel}
      </TabsContent>
      <TabsContent value="revision" className="mt-2">
        {revisionPanel}
      </TabsContent>
    </Tabs>
  )
}
