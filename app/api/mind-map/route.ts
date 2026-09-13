import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { aiChatCompletion, isAIConfigured } from "@/lib/ai/provider"
import { enforceQuota, refundQuota } from "@/lib/services/quota"


export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }


    // Enforce AI quota (atomic: checks and consumes in one statement)

    const quotaDenied = await enforceQuota(user.id, "mind_map")

    if (quotaDenied) return quotaDenied

    if (!(await isAIConfigured())) {
      return NextResponse.json({ error: "AI provider API key not configured" }, { status: 500 })
    }

    const { documentText, topic, depth = 3, noteId, documentId } = await req.json()

    if (!documentText || !topic) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const maxDepth = Math.min(Math.max(2, depth), 5)

    // Generate mind map structure using AI - keep it simple to avoid truncation
    const prompt = `Create a mind map about "${topic}" based on this material:

${documentText.slice(0, 6000)}

Rules:
- Max ${maxDepth} levels deep
- 4-6 main branches
- 2-4 children per branch
- Short labels (2-5 words)
- Brief descriptions

Return ONLY this JSON format (no markdown):
{"root":{"id":"root","label":"Topic","description":"Overview","children":[{"id":"b1","label":"Branch","description":"Info","children":[{"id":"l1","label":"Leaf","description":"Detail"}]}]}}`

    const response = await aiChatCompletion({
      messages: [
        { 
          role: "system", 
          content: "You are a JSON generator. Return ONLY valid JSON, no markdown code blocks, no explanations." 
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 8000,
    }, { task: "mind_map", agent: "study_ai" })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("AI provider error:", errorText)
      return NextResponse.json({ error: "Failed to generate mind map" }, { status: 500 })
    }

    const data = await response.json()
    const rawContent = data.choices?.[0]?.message?.content?.trim()

    if (!rawContent) {
      return NextResponse.json({ error: "Failed to generate mind map" }, { status: 500 })
    }

    // Parse the JSON response with robust handling
    let mindMapData
    try {
      // Remove markdown code blocks if present
      let jsonStr = rawContent
      const jsonMatch = rawContent.match(/```(?:json)?\n?([\s\S]*?)\n?```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      }
      
      // Clean up the string
      jsonStr = jsonStr.trim()
      
      // Try to find valid JSON object
      const startIdx = jsonStr.indexOf('{')
      if (startIdx > 0) {
        jsonStr = jsonStr.slice(startIdx)
      }
      
      // Handle truncated JSON by finding last complete object
      let lastValidIdx = jsonStr.length
      for (let i = jsonStr.length - 1; i >= 0; i--) {
        if (jsonStr[i] === '}') {
          // Count braces to find matching structure
          let braceCount = 0
          let isValid = true
          for (let j = 0; j <= i; j++) {
            if (jsonStr[j] === '{') braceCount++
            if (jsonStr[j] === '}') braceCount--
            if (braceCount < 0) {
              isValid = false
              break
            }
          }
          if (isValid && braceCount === 0) {
            lastValidIdx = i + 1
            break
          }
        }
      }
      
      jsonStr = jsonStr.slice(0, lastValidIdx)
      mindMapData = JSON.parse(jsonStr)
      
      // Ensure we have a root node
      if (!mindMapData.root) {
        if (mindMapData.id && mindMapData.label) {
          mindMapData = { root: mindMapData }
        } else {
          throw new Error("Invalid mind map structure")
        }
      }
    } catch (parseError) {
      console.error("Failed to parse mind map JSON:", rawContent.slice(0, 500))
      return NextResponse.json({ error: "Failed to parse mind map structure. Please try again." }, { status: 500 })
    }

    // Build source_ids array from provided IDs
    const sourceIds: string[] = []
    if (noteId) sourceIds.push(noteId)
    if (documentId) sourceIds.push(documentId)

    // Save to database - actual columns: id, source_type, subject, title, user_id, source_ids, map_data
    const { data: savedMap, error: dbError } = await supabase
      .from("mind_maps")
      .insert({
        user_id: user.id,
        title: topic,
        subject: topic,
        map_data: mindMapData,
        source_type: noteId ? "note" : documentId ? "document" : "text",
        source_ids: sourceIds.length > 0 ? sourceIds : null,
      })
      .select()
      .single()

    if (dbError) {
      console.error("Error saving mind map:", dbError)
      return NextResponse.json({ error: "Failed to save mind map" }, { status: 500 })
    }

    return NextResponse.json({
      id: savedMap.id,
      title: savedMap.title,
      map_data: mindMapData,
    })
  } catch (error) {
    console.error("Mind map generation error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (id) {
      // Fetch single mind map
      const { data, error } = await supabase
        .from("mind_maps")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single()

      if (error || !data) {
        return NextResponse.json({ error: "Mind map not found" }, { status: 404 })
      }

      return NextResponse.json(data)
    }

    // Fetch all mind maps - actual columns: id, title, subject, source_type, map_data, created_at, updated_at
    const { data, error } = await supabase
      .from("mind_maps")
      .select("id, title, subject, source_type, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: "Failed to fetch mind maps" }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error("Error fetching mind maps:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, title, nodes } = await req.json()

    if (!id) {
      return NextResponse.json({ error: "Missing mind map ID" }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (title) updateData.title = title
    if (nodes) {
      updateData.map_data = nodes
    }

    const { error } = await supabase.from("mind_maps").update(updateData).eq("id", id).eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: "Failed to update mind map" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating mind map:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Missing mind map ID" }, { status: 400 })
    }

    const { error } = await supabase.from("mind_maps").delete().eq("id", id).eq("user_id", user.id)

    if (error) {
      return NextResponse.json({ error: "Failed to delete mind map" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting mind map:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
