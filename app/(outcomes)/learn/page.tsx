import { SproutChat } from "@/components/sprout/sprout-chat"

export const metadata = { title: "Learn" }

export default function LearnPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Learn</h1>
        <p className="text-sm text-muted-foreground">
          Work through anything you&apos;re stuck on with Sprout.
        </p>
      </div>
      <SproutChat />
    </div>
  )
}
