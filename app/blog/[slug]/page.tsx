import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Calendar, Clock, ArrowLeft, Eye } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import ReactMarkdown from "react-markdown"
import { createClient } from "@supabase/supabase-js"
import type { Metadata } from "next"

async function getBlogPost(slug: string) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    console.log("[v0] Fetching blog post with slug:", slug)

    // Fetch the blog post
    const { data: post, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .single()

    if (error) {
      console.error("[v0] Error fetching blog post:", error)
      return null
    }

    if (!post) {
      console.log("[v0] Blog post not found")
      return null
    }

    console.log("[v0] Successfully fetched blog post:", post.title)

    // Increment view count
    const { error: updateError } = await supabase
      .from("blog_posts")
      .update({ views: (post.views || 0) + 1 })
      .eq("id", post.id)

    if (updateError) {
      console.error("[v0] Error updating view count:", updateError)
    }

    return post
  } catch (error) {
    console.error("[v0] Error in getBlogPost:", error)
    return null
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getBlogPost(slug)

  if (!post) {
    return {
      title: "Post Not Found | QuillGlow Blog",
      description: "The blog post you're looking for could not be found.",
    }
  }

  return {
    title: `${post.title} | QuillGlow Blog`,
    description: post.excerpt || post.title,
    keywords: [
      post.category,
      "study tips",
      "learning strategies",
      "student productivity",
      "academic success",
      ...(post.tags || []),
    ],
    authors: post.author_name ? [{ name: post.author_name }] : undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt || post.title,
      url: `https://www.quillglow.com/blog/${post.slug}`,
      type: "article",
      publishedTime: post.published_at,
      authors: post.author_name ? [post.author_name] : undefined,
      images: post.cover_image
        ? [
            {
              url: post.cover_image,
              width: 1200,
              height: 630,
              alt: post.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt || post.title,
      images: post.cover_image ? [post.cover_image] : undefined,
    },
    alternates: {
      canonical: `https://www.quillglow.com/blog/${post.slug}`,
    },
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getBlogPost(slug)

  if (!post) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-16">
        <article className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Back Button */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Blog
          </Link>

          {/* Category Badge */}
          <div className="mb-4">
            <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {post.category}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6 text-balance">{post.title}</h1>

          {/* Meta Information */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-8 pb-8 border-b">
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
            {post.views > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {post.views} views
              </span>
            )}
            {post.author_name && (
              <span className="flex items-center gap-2">
                {post.author_avatar && (
                  <img
                    src={post.author_avatar || "/placeholder.svg"}
                    alt={post.author_name}
                    className="h-6 w-6 rounded-full"
                  />
                )}
                <span>By {post.author_name}</span>
              </span>
            )}
          </div>

          {/* Cover Image */}
          {post.cover_image && (
            <div className="mb-8 rounded-2xl overflow-hidden">
              <img src={post.cover_image || "/placeholder.svg"} alt={post.title} className="w-full h-auto" />
            </div>
          )}

          {/* Content */}
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-6 mt-8">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 mt-8">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-3 mt-6">{children}</h3>
                ),
                p: ({ children }) => <p className="text-base text-muted-foreground leading-relaxed mb-4">{children}</p>,
                ul: ({ children }) => (
                  <ul className="list-disc list-inside space-y-2 mb-4 text-muted-foreground">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-inside space-y-2 mb-4 text-muted-foreground">{children}</ol>
                ),
                li: ({ children }) => <li className="text-base">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                a: ({ href, children }) => (
                  <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground my-4">
                    {children}
                  </blockquote>
                ),
                code: ({ children }) => (
                  <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
                ),
              }}
            >
              {post.content}
            </ReactMarkdown>
          </div>

          {/* Back to Blog Link */}
          <div className="mt-12 pt-8 border-t">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:gap-3 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to all articles
            </Link>
          </div>
        </article>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              headline: post.title,
              description: post.excerpt,
              image: post.cover_image,
              datePublished: post.published_at,
              dateModified: post.updated_at || post.published_at,
              author: {
                "@type": "Person",
                name: post.author_name || "QuillGlow Team",
                image: post.author_avatar,
              },
              publisher: {
                "@type": "Organization",
                name: "QuillGlow",
                logo: {
                  "@type": "ImageObject",
                  url: "https://www.quillglow.com/logo.png",
                },
              },
              mainEntityOfPage: {
                "@type": "WebPage",
                "@id": `https://www.quillglow.com/blog/${post.slug}`,
              },
              articleSection: post.category,
              wordCount: post.content?.split(/\s+/).length || 0,
              timeRequired: post.read_time,
            }),
          }}
        />
      </main>

      <Footer />
    </div>
  )
}
