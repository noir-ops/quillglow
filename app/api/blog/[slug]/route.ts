import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
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

    // Fetch the blog post
    const { data: post, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .single()

    if (error || !post) {
      console.error("[v0] Error fetching blog post:", error)
      return NextResponse.json({ error: "Blog post not found" }, { status: 404 })
    }

    // Increment view count
    await supabase
      .from("blog_posts")
      .update({ views: (post.views || 0) + 1 })
      .eq("id", post.id)

    return NextResponse.json({ post })
  } catch (error) {
    console.error("[v0] Error in blog post API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
