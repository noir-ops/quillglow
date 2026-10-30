import Link from "next/link"
import { ShoppingBag, ArrowLeft } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { StoreLaunchSignup } from "@/components/store/store-launch-signup"

export const metadata = { title: "Store coming soon | QuillGlow", description: "We're rebuilding the QuillGlow Store. Sign up to hear when it opens." }
export default function StoreComingSoonPage() {
  return <div className="min-h-screen bg-background text-foreground">
    <Header />
    <main className="relative overflow-hidden px-4 pt-32 pb-20 sm:pt-40">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-50/60 via-purple-50/60 to-pink-50/60 dark:from-blue-950/20 dark:via-purple-950/20 dark:to-pink-950/20" />
      <div className="relative mx-auto max-w-xl text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10"><ShoppingBag className="h-10 w-10 text-primary" /></div>
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">QuillGlow Store</p>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">Coming soon</h1>
        <p className="text-lg text-muted-foreground">We're giving the Store an overhaul. Sign up for a notification when the new Store opens.</p>
        <StoreLaunchSignup />
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <Button asChild variant="ghost"><Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" />Back to Dashboard</Link></Button>
          <Button asChild variant="outline"><Link href="/shop/orders">View existing orders</Link></Button>
        </div>
      </div>
    </main>
    <Footer />
  </div>
}
