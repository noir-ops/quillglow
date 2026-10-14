"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StudyTogetherHome } from "./study-together-home"
import { Hash, MessageSquare } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function StudyTogetherHub() {
  const [activeTab, setActiveTab] = useState("community")
  const router = useRouter()

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full sm:w-auto grid grid-cols-2 h-auto bg-transparent border-b-0">
              <TabsTrigger
                value="community"
                className="flex items-center gap-2 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3"
              >
                <Hash className="w-4 h-4" />
                <span className="hidden sm:inline">Community</span>
              </TabsTrigger>
              <TabsTrigger
                value="rooms"
                className="flex items-center gap-2 data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none py-3"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline">Your Rooms</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} className="h-full">
          <TabsContent value="community" className="h-full m-0 p-0">
            <div className="h-full">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/study-together/community")}
                className="w-full h-full"
              >
                <div className="text-center space-y-2 py-12">
                  <Hash className="w-12 h-12 mx-auto text-primary" />
                  <h2 className="text-xl font-semibold">Community Channels</h2>
                  <p className="text-muted-foreground">Join public channels and chat with students worldwide</p>
                  <Button className="mt-4">Open Community Chat</Button>
                </div>
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="rooms" className="h-full m-0 p-0">
            <StudyTogetherHome />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
