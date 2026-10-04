"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Send, MessageSquare, User, Bot, Ticket, Plus, Search } from "lucide-react"
import { getUserTickets, getTicketMessages, sendUserMessage } from "./actions"

interface Message {
  id: string
  name: string
  email: string
  message: string
  created_at: string
  is_admin_reply: boolean
  thread_id: string
  ticket_number: string
}

interface TicketInfo {
  ticket_number: string
  subject: string
  created_at: string
  status: string
}

export default function SupportChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [tickets, setTickets] = useState<TicketInfo[]>([])
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showTicketList, setShowTicketList] = useState(false)
  const [showNewTicketForm, setShowNewTicketForm] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load tickets when email is provided - REMOVED AUTO TRIGGER
  // useEffect(() => {
  //   if (email && email.includes("@")) {
  //     loadTickets()
  //   }
  // }, [email])

  // Load messages when ticket is selected
  useEffect(() => {
    if (selectedTicket && email) {
      loadMessages()
    }
  }, [selectedTicket, email])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const loadTickets = async () => {
    const { tickets: fetchedTickets } = await getUserTickets(email)
    setTickets(fetchedTickets)
    if (fetchedTickets.length > 0) {
      setShowTicketList(true)
    } else {
      setShowNewTicketForm(true)
    }
  }

  const loadMessages = async () => {
    if (!selectedTicket) return
    const { messages: fetchedMessages } = await getTicketMessages(email, selectedTicket)
    setMessages(fetchedMessages)
  }

  const handleSelectTicket = (ticketNumber: string) => {
    setSelectedTicket(ticketNumber)
    setShowTicketList(false)
    setShowNewTicketForm(false)
  }

  const handleNewTicket = () => {
    setSelectedTicket(null)
    setMessages([])
    setShowNewTicketForm(true)
    setShowTicketList(false)
  }

  const handleBackToTickets = () => {
    setSelectedTicket(null)
    setMessages([])
    setShowTicketList(true)
    setShowNewTicketForm(false)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name || !email || !newMessage.trim()) return
    if (!selectedTicket && !subject.trim()) return

    setIsLoading(true)

    const formData = new FormData()
    formData.append("name", name)
    formData.append("email", email)
    formData.append("message", newMessage)

    if (selectedTicket) {
      formData.append("ticketNumber", selectedTicket)
    } else {
      formData.append("subject", subject)
    }

    const result = await sendUserMessage(formData)

    if (result.success) {
      setNewMessage("")
      setSubject("")

      // If this was a new ticket, select it
      if (!selectedTicket && result.ticketNumber) {
        setSelectedTicket(result.ticketNumber)
        setShowNewTicketForm(false)
      }

      await loadMessages()
      await loadTickets()
    }

    setIsLoading(false)
  }

  const handleSearchTickets = async () => {
    if (!email || !email.includes("@")) {
      alert("Please enter a valid email address")
      return
    }
    if (!name.trim()) {
      alert("Please enter your name")
      return
    }
    await loadTickets()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-blue-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 mb-4">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent mb-2">
            Support Chat
          </h1>
          <p className="text-muted-foreground">Get help from our support team</p>
        </div>

        {/* Email Input (shown first) */}
        {!showTicketList && !showNewTicketForm && !selectedTicket && (
          <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-900/80 border-2 shadow-xl p-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold mb-2">Enter Your Email</h2>
              <p className="text-sm text-muted-foreground">We'll show you your support tickets</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Your Name</label>
                <Input
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-white dark:bg-gray-800"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Your Email</label>
                <Input
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white dark:bg-gray-800"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearchTickets()
                    }
                  }}
                />
              </div>
              <Button
                onClick={handleSearchTickets}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              >
                <Search className="w-4 h-4 mr-2" />
                Search My Tickets
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Your email is used to identify your conversations. Only you can see your messages.
              </p>
            </div>
          </Card>
        )}

        {/* Ticket List */}
        {showTicketList && (
          <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-900/80 border-2 shadow-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Your Support Tickets</h2>
              <Button onClick={handleNewTicket} size="sm" className="bg-gradient-to-r from-blue-500 to-indigo-600">
                <Plus className="w-4 h-4 mr-2" />
                New Ticket
              </Button>
            </div>
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <button
                  key={ticket.ticket_number}
                  onClick={() => handleSelectTicket(ticket.ticket_number)}
                  className="w-full text-left p-4 rounded-lg border-2 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Ticket className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <span className="font-mono text-sm font-medium">{ticket.ticket_number}</span>
                        <Badge variant={ticket.status === "resolved" ? "default" : "secondary"} className="text-xs">
                          {ticket.status}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium truncate">{ticket.subject}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* New Ticket Form */}
        {showNewTicketForm && !selectedTicket && (
          <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-900/80 border-2 shadow-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Create New Ticket</h2>
              {tickets.length > 0 && (
                <Button onClick={handleBackToTickets} variant="outline" size="sm">
                  Back to Tickets
                </Button>
              )}
            </div>
            <form onSubmit={handleSendMessage} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Subject</label>
                <Input
                  placeholder="Brief description of your issue"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="bg-white dark:bg-gray-800"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Message</label>
                <Textarea
                  placeholder="Describe your issue in detail..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="min-h-[120px] bg-white dark:bg-gray-800"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading || !subject.trim() || !newMessage.trim()}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              >
                <Send className="w-4 h-4 mr-2" />
                Create Ticket
              </Button>
            </form>
          </Card>
        )}

        {/* Chat Interface */}
        {selectedTicket && (
          <Card className="backdrop-blur-sm bg-white/80 dark:bg-gray-900/80 border-2 shadow-xl">
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button onClick={handleBackToTickets} variant="outline" size="sm">
                  ← Back
                </Button>
                <div>
                  <div className="flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-mono text-sm font-medium">{selectedTicket}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Support Conversation</p>
                </div>
              </div>
            </div>

            {/* Chat Messages */}
            <ScrollArea ref={scrollRef} className="h-[400px] md:h-[500px] p-6">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="w-16 h-16 text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">No messages yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.is_admin_reply ? "flex-row" : "flex-row-reverse"}`}>
                      {/* Avatar */}
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          msg.is_admin_reply
                            ? "bg-gradient-to-br from-blue-500 to-indigo-600"
                            : "bg-gradient-to-br from-green-500 to-emerald-600"
                        }`}
                      >
                        {msg.is_admin_reply ? (
                          <Bot className="w-4 h-4 text-white" />
                        ) : (
                          <User className="w-4 h-4 text-white" />
                        )}
                      </div>

                      {/* Message Bubble */}
                      <div className={`flex-1 max-w-[85%] ${msg.is_admin_reply ? "text-left" : "text-right"}`}>
                        <div
                          className={`inline-block rounded-2xl px-4 py-3 break-words ${
                            msg.is_admin_reply
                              ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                              : "bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 px-2">
                          {new Date(msg.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-6 border-t bg-gray-50/50 dark:bg-gray-800/50">
              <div className="flex flex-col sm:flex-row gap-3">
                <Textarea
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 min-h-[60px] resize-none bg-white dark:bg-gray-900"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage(e)
                    }
                  }}
                />
                <Button
                  type="submit"
                  disabled={isLoading || !newMessage.trim()}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 sm:self-end"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Press Enter to send, Shift+Enter for new line</p>
            </form>
          </Card>
        )}
      </div>
    </div>
  )
}
