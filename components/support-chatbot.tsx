"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MessageCircle, X, Send, Bot, User, Loader2, Sparkles, CheckCircle2 } from "lucide-react"
import { ChatMarkdown } from "@/components/chat/chat-markdown"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

interface Message {
  role: "user" | "assistant"
  content: string
}

interface SupportForm {
  name: string
  email: string
  subject: string
  message: string
}

export function SupportChatbot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi there! I'm the QuillGlow Assistant. How can I help you today? Feel free to ask about features, plans, or any issues you're facing.",
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showSupportForm, setShowSupportForm] = useState(false)
  const [supportForm, setSupportForm] = useState<SupportForm>({
    name: "",
    email: "",
    subject: "",
    message: "",
  })
  const [ticketCreated, setTicketCreated] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: userMessage }])
    setIsLoading(true)

    // Check if user is requesting human support
    const humanKeywords = [
      "human",
      "real person",
      "agent",
      "support team",
      "talk to someone",
      "speak to someone",
      "real human",
      "actual person",
    ]
    const wantsHuman = humanKeywords.some((keyword) => userMessage.toLowerCase().includes(keyword))

    if (wantsHuman) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I understand you'd like to speak with a human. I'll help you create a support ticket. Please fill in your details below and our team will get back to you within 24 hours.",
        },
      ])
      setShowSupportForm(true)
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: userMessage }].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      const data = await response.json()

      if (data.requestHumanSupport) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.response }])
        setShowSupportForm(true)
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.response }])
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I'm having trouble connecting. Please try again or email support@quillglow.com for help.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const submitSupportTicket = async () => {
    if (!supportForm.name || !supportForm.email || !supportForm.subject || !supportForm.message) {
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supportTicket: supportForm }),
      })

      const data = await response.json()

      if (data.ticketNumber) {
        setTicketCreated(data.ticketNumber)
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.message,
          },
        ])
        setShowSupportForm(false)
        setSupportForm({ name: "", email: "", subject: "", message: "" })
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, there was an issue creating your ticket. Please email support@quillglow.com directly.",
          },
        ])
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, there was an issue creating your ticket. Please email support@quillglow.com directly.",
        },
      ])
    } finally {
      setIsLoading(false)
      setShowSupportForm(false)
    }
  }

  return (
    <>
      {/* Chat Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-24 sm:bottom-6 right-4 sm:right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg hover:shadow-xl transition-all ${isOpen ? "hidden" : ""}`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
      >
        <MessageCircle className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-300"></span>
        </span>
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 sm:bottom-6 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 h-[60vh] sm:h-[500px] max-h-[60vh] sm:max-h-[80vh] bg-background border-2 border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">QuillGlow Assistant</h3>
                  <p className="text-xs text-white/80">Here to help you study better</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      message.role === "user"
                        ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <ChatMarkdown content={message.content} />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </motion.div>
              ))}

              {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 justify-start">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="bg-muted rounded-2xl px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </motion.div>
              )}

              {/* Support Form */}
              {showSupportForm && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-muted rounded-xl p-4 space-y-3"
                >
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-500" />
                    Create Support Ticket
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="name" className="text-xs">
                        Name
                      </Label>
                      <Input
                        id="name"
                        placeholder="Your name"
                        value={supportForm.name}
                        onChange={(e) => setSupportForm((prev) => ({ ...prev, name: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email" className="text-xs">
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={supportForm.email}
                        onChange={(e) => setSupportForm((prev) => ({ ...prev, email: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="subject" className="text-xs">
                        Subject
                      </Label>
                      <Input
                        id="subject"
                        placeholder="What's this about?"
                        value={supportForm.subject}
                        onChange={(e) => setSupportForm((prev) => ({ ...prev, subject: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="message" className="text-xs">
                        Message
                      </Label>
                      <Textarea
                        id="message"
                        placeholder="Describe your issue..."
                        value={supportForm.message}
                        onChange={(e) => setSupportForm((prev) => ({ ...prev, message: e.target.value }))}
                        className="text-sm min-h-[80px]"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowSupportForm(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={submitSupportTicket}
                      disabled={
                        isLoading ||
                        !supportForm.name ||
                        !supportForm.email ||
                        !supportForm.subject ||
                        !supportForm.message
                      }
                      className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white"
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Ticket"}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Ticket Created Success */}
              {ticketCreated && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-center"
                >
                  <CheckCircle2 className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                  <p className="font-semibold text-blue-700 dark:text-blue-300">Ticket Created!</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Your ticket number: <span className="font-mono font-bold">{ticketCreated}</span>
                  </p>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {!showSupportForm && (
              <div className="p-4 border-t border-border">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    sendMessage()
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask me anything..."
                    className="flex-1"
                    disabled={isLoading}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={isLoading || !input.trim()}
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Type "human" to create a support ticket
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
