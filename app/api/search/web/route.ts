import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { aiChatCompletion, isAIConfigured } from "@/lib/ai/provider"
import { enforceQuota, refundQuota } from "@/lib/services/quota"

const BLOCKED_KEYWORDS = [
  "porn",
  "xxx",
  "sex",
  "adult",
  "nude",
  "nsfw",
  "18+",
  "explicit",
  "erotic",
  "hentai",
  "fetish",
  "webcam",
  "escort",
  "dating",
  "hookup",
  "onlyfans",
  "sexy",
  "hot girls",
  "hot boys",
]

function containsBlockedContent(text: string): boolean {
  const lowerText = text.toLowerCase()
  return BLOCKED_KEYWORDS.some((keyword) => lowerText.includes(keyword))
}

function filterResults(results: any[]): any[] {
  return results.filter((result) => {
    const title = result.title || ""
    const description = result.description || ""
    return !containsBlockedContent(title) && !containsBlockedContent(description)
  })
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }


    // Enforce AI quota (atomic: checks and consumes in one statement)

    const quotaDenied = await enforceQuota(user.id, "search_summary")

    if (quotaDenied) return quotaDenied

    const { query, searchType = "all" } = await request.json()

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    if (containsBlockedContent(query)) {
      return NextResponse.json(
        {
          error: "inappropriate_content",
          message: "This search query contains inappropriate content. QuillGlow is an educational platform.",
        },
        { status: 403 },
      )
    }

    // Save to search history
    await supabase.from("search_history").insert({
      user_id: user.id,
      query,
      search_type: searchType,
    })

    const results: any = {
      query,
      articles: [],
      videos: [],
      aiSummary: null,
    }

    // Google Custom Search for articles
    if (searchType === "all" || searchType === "articles") {
      const googleApiKey = process.env.GOOGLE_CUSTOM_SEARCH_KEY
      const searchEngineId = process.env.NEXT_PUBLIC_GOOGLE_SEARCH_ENGINE_ID

      if (googleApiKey && searchEngineId) {
        const googleResponse = await fetch(
          `https://www.googleapis.com/customsearch/v1?key=${googleApiKey}&cx=${searchEngineId}&q=${encodeURIComponent(
            query,
          )}&num=10&safe=active&filter=1`,
        )

        if (googleResponse.ok) {
          const googleData = await googleResponse.json()
          const rawArticles = (googleData.items || []).map((item: any) => ({
            title: item.title,
            url: item.link,
            description: item.snippet,
            thumbnail: item.pagemap?.cse_thumbnail?.[0]?.src || null,
            source: new URL(item.link).hostname,
          }))
          results.articles = filterResults(rawArticles)
        }
      }
    }

    // YouTube API for videos
    if (searchType === "all" || searchType === "videos") {
      const youtubeApiKey = process.env.YOUTUBE_API_KEY

      if (youtubeApiKey) {
        const youtubeResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/search?key=${youtubeApiKey}&q=${encodeURIComponent(
            query,
          )}&part=snippet&type=video&maxResults=10&relevanceLanguage=en&safeSearch=strict&videoEmbeddable=true&videoCategoryId=27`,
        )

        if (youtubeResponse.ok) {
          const youtubeData = await youtubeResponse.json()
          const rawVideos = (youtubeData.items || []).map((item: any) => ({
            id: item.id.videoId,
            title: item.snippet.title,
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.medium.url,
            channel: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
          }))
          results.videos = filterResults(rawVideos)
        }
      }
    }

    // AI Summary
    if (searchType === "all") {
      const aiReady = await isAIConfigured()

      if (aiReady) {
        const aiResponse = await aiChatCompletion({
          messages: [
            {
              role: "system",
              content:
                "You are an educational AI assistant for students. Provide clear, concise, age-appropriate summaries. Focus on key concepts and learning objectives. NEVER provide adult, sexual, or inappropriate content. If asked about inappropriate topics, politely decline and suggest educational alternatives.",
            },
            {
              role: "user",
              content: `Provide a brief educational summary about: ${query}. Include key points students should know.`,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }, { task: "web_research", agent: "sprout_ai" })

        if (aiResponse.ok) {
          const aiData = await aiResponse.json()
          results.aiSummary = aiData.choices[0]?.message?.content || null
        }
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error("[v0] Search error:", error)
    return NextResponse.json({ error: "Failed to perform search" }, { status: 500 })
  }
}
