import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Home, Search, BookOpen, ArrowLeft } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Animated 404 */}
        <div className="relative">
          <h1 className="text-[150px] md:text-[200px] font-bold text-primary/10 leading-none select-none">404</h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <BookOpen className="w-24 h-24 md:w-32 md:h-32 text-primary animate-pulse" />
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-accent rounded-full animate-ping" />
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">Oops! Page Not Found</h2>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Looks like this page took a study break. Let's get you back on track!
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
          <Button asChild size="lg" className="min-w-[200px]">
            <Link href="/">
              <Home className="mr-2 h-5 w-5" />
              Back to Home
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="min-w-[200px] bg-transparent">
            <Link href="/blog">
              <Search className="mr-2 h-5 w-5" />
              Browse Blog
            </Link>
          </Button>
        </div>

        {/* Helpful Links */}
        <div className="pt-8 border-t border-border/50">
          <p className="text-sm text-muted-foreground mb-4">Or try one of these popular pages:</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link href="/about" className="text-sm text-primary hover:underline flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              About Us
            </Link>
            <Link href="/pricing" className="text-sm text-primary hover:underline flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              Pricing
            </Link>
            <Link href="/contact" className="text-sm text-primary hover:underline flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              Contact
            </Link>
            <Link href="/auth/login" className="text-sm text-primary hover:underline flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
