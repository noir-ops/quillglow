"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bell, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface Notification {
  id: number
  category: string
  title: string
  body: string | null
  action_url: string | null
  read_at: string | null
  created_at: string
}

/**
 * Was previously nothing — /api/notifications existed and pay_applicant() now
 * writes real rows into it, but nothing in the app ever rendered them. A
 * paid or shortlisted student had no way to discover it inside the product.
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const res = await fetch("/api/notifications")
    if (res.ok) {
      const data = await res.json()
      setItems(data.notifications ?? [])
      setUnread(data.unread ?? 0)
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // Light polling rather than a websocket — notifications here are
    // infrequent (scholarship status changes, payments), so a 60s interval
    // is enough to feel current without adding real-time infrastructure.
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [])

  const onOpenChange = async (next: boolean) => {
    setOpen(next)
    if (next) {
      const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id)
      if (unreadIds.length > 0) {
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: unreadIds }),
        })
        setUnread(0)
        setItems((prev) => prev.map((n) => (unreadIds.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n)))
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            items.map((n) => {
              const content = (
                <div className={`border-b px-4 py-3 last:border-0 ${!n.read_at ? "bg-primary/5" : ""}`}>
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              )
              return n.action_url ? (
                <Link key={n.id} href={n.action_url} onClick={() => setOpen(false)} className="block hover:bg-accent/40">
                  {content}
                </Link>
              ) : (
                <div key={n.id}>{content}</div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
