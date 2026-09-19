"use server"


import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export async function getUserTickets(email: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("contact_messages")
    .select("ticket_number, subject, created_at, status")
    .eq("email", email)
    .is("parent_id", null) // Only get root messages (not replies)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error fetching tickets:", error)
    return { tickets: [], error: error.message }
  }

  // Get unique tickets by ticket_number
  const uniqueTickets = data?.reduce((acc: any[], curr) => {
    if (!acc.find((t) => t.ticket_number === curr.ticket_number)) {
      acc.push(curr)
    }
    return acc
  }, [])

  return { tickets: uniqueTickets || [], error: null }
}

export async function getTicketMessages(email: string, ticketNumber: string) {
  const supabase = createAdminClient()

  const { data: rootMessage } = await supabase
    .from("contact_messages")
    .select("id, thread_id")
    .eq("ticket_number", ticketNumber)
    .is("parent_id", null)
    .single()

  if (!rootMessage) {
    return { messages: [], error: "Ticket not found" }
  }

  const { data, error } = await supabase
    .from("contact_messages")
    .select("*")
    .eq("thread_id", rootMessage.thread_id || rootMessage.id)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[v0] Error fetching messages:", error)
    return { messages: [], error: error.message }
  }

  return { messages: data || [], error: null }
}

export async function sendUserMessage(formData: FormData) {
  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const message = formData.get("message") as string
  const subject = formData.get("subject") as string
  const ticketNumber = formData.get("ticketNumber") as string | null

  if (!name || !email || !message) {
    return { success: false, error: "All fields are required" }
  }

  const supabase = createAdminClient()

  let finalTicketNumber = ticketNumber
  let threadId = null
  let parentId = null

  if (!ticketNumber) {
    const date = new Date()
    const dateStr = date.toISOString().split("T")[0].replace(/-/g, "")

    const { count } = await supabase
      .from("contact_messages")
      .select("*", { count: "exact", head: true })
      .like("ticket_number", `SF-${dateStr}%`)

    const nextNumber = (count || 0) + 1
    finalTicketNumber = `SF-${dateStr}-${String(nextNumber).padStart(4, "0")}`
  } else {
    const { data: rootMessage } = await supabase
      .from("contact_messages")
      .select("id, thread_id, ticket_number")
      .eq("ticket_number", ticketNumber)
      .is("parent_id", null)
      .single()

    if (rootMessage) {
      threadId = rootMessage.thread_id || rootMessage.id
      parentId = rootMessage.id

      const { count } = await supabase
        .from("contact_messages")
        .select("*", { count: "exact", head: true })
        .eq("thread_id", threadId)

      const replyNumber = count || 1
      finalTicketNumber = `${ticketNumber}-R${replyNumber}`
    }
  }

  const newMessage = {
    name,
    email,
    subject: subject || (ticketNumber ? "Re: Support Message" : "New Support Message"),
    message,
    status: "in_progress",
    ticket_number: finalTicketNumber,
    thread_id: threadId,
    parent_id: parentId,
    is_admin_reply: false,
    sent_via_email: false,
  }

  const { data, error } = await supabase.from("contact_messages").insert(newMessage).select().single()

  if (error) {
    console.error("[v0] Error sending message:", error)
    return { success: false, error: error.message }
  }

  if (!ticketNumber && data) {
    await supabase.from("contact_messages").update({ thread_id: data.id }).eq("id", data.id)
  }

  revalidatePath("/support")
  return { success: true, message: data, ticketNumber: ticketNumber || finalTicketNumber }
}
