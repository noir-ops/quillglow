export const QUILLY = {
    id: "quilly-ai-bot",
    display_name: "Quilly",
    avatar_url: "/placeholder.svg?height=40&width=40&text=Q",
    bio: "QuillGlow's AI Study Buddy - Here to help you learn, stay motivated, and ace your goals! 🎓✨",
  }
  
  export function getQuillyAvatar() {
    return QUILLY.avatar_url
  }
  
  export function detectQuillyTrigger(content: string): { isQuilly: boolean; prompt: string } {
    const normalizedContent = content.toLowerCase().trim()
  
    // Check if "quilly" appears anywhere in the message
    if (normalizedContent.includes("quilly")) {
      // Extract the actual question/prompt by removing "quilly" and common punctuation
      const prompt = content.replace(/quilly[:\s,]*/gi, "").trim()
  
      return {
        isQuilly: true,
        prompt: prompt || "Hi Quilly! How can you help me today?",
      }
    }
  
    return { isQuilly: false, prompt: "" }
  }
  