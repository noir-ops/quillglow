import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Calendar, Clock, ArrowRight, Eye } from "lucide-react"
import Link from "next/link"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Study Tips & Learning Strategies Blog | QuillGlow",
  description:
    "Discover effective study techniques, productivity tips, and learning strategies on the QuillGlow blog. Expert advice to help students study smarter and achieve academic success.",
  keywords: [
    "study tips blog",
    "learning strategies",
    "student productivity tips",
    "study techniques",
    "academic success tips",
    "how to study effectively",
    "student blog",
    "education blog",
  ],
  openGraph: {
    title: "Study Tips & Learning Strategies Blog | QuillGlow",
    description: "Expert study tips and learning strategies to help students succeed academically.",
    url: "https://www.quillglow.com/blog",
    type: "website",
  },
  alternates: {
    canonical: "https://www.quillglow.com/blog",
  },
}

async function getBlogPosts() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    })

    console.log("[v0] Fetching blog posts from database...")

    const { data: posts, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("published", true)
      .order("published_at", { ascending: false })

    if (error) {
      console.error("[v0] Database error:", error)
      return []
    }

    console.log("[v0] Successfully fetched", posts?.length || 0, "blog posts")
    return posts || []
  } catch (error) {
    console.error("[v0] Error fetching blog posts:", error)
    return []
  }
}

export default async function BlogPage() {
  const blogPosts = await getBlogPosts()

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-16">
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-12 text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6">QuillGlow Blog</h1>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
              Tips, insights, and strategies to help you study smarter and achieve your academic goals.
            </p>
          </div>

          {/* Blog Posts Grid */}
          {blogPosts.length > 0 ? (
            <div className="grid gap-8 sm:grid-cols-2">
              {blogPosts.map((post: any) => (
                <article
                  key={post.id}
                  className="group rounded-2xl border bg-card p-6 sm:p-8 transition-all hover:shadow-lg hover:border-primary/50"
                >
                  {post.cover_image && (
                    <div className="mb-6 -mx-6 -mt-6 sm:-mx-8 sm:-mt-8">
                      <img
                        src={post.cover_image || "/placeholder.svg"}
                        alt={post.title}
                        className="w-full h-48 object-cover rounded-t-2xl"
                      />
                    </div>
                  )}

                  <div className="mb-4 flex items-center justify-between">
                    <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {post.category}
                    </span>
                    {post.views > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        {post.views}
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors">
                    {post.title}
                  </h2>

                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mb-4">{post.excerpt}</p>

                  <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(post.published_at).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {post.read_time}
                      </span>
                    </div>

                    <Link
                      href={`/blog/${post.slug}`}
                      className="flex items-center gap-1 font-medium text-primary hover:gap-2 transition-all"
                    >
                      Read More
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="text-center rounded-2xl border bg-card p-8 sm:p-12">
              <p className="text-base sm:text-lg text-muted-foreground">
                No blog posts available yet. Check back soon for study tips and learning strategies!
              </p>
            </div>
          )}

          {/* Coming Soon Message */}
          <div className="mt-12 text-center rounded-2xl border bg-card p-8 sm:p-12">
            <p className="text-base sm:text-lg text-muted-foreground">
              More articles coming soon! Follow us for the latest updates on study techniques, productivity tips, and
              learning strategies.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
