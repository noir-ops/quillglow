import { streamAI } from "./streaming"

const usage: any[] = []
;(globalThis as any).__DB = { rpc: async (_f: string, p: any) => { usage.push(p); return { data: 1 } } }

function sse(chunks: string[]) {
  const enc = new TextEncoder()
  return new ReadableStream({
    start(c) { for (const ch of chunks) c.enqueue(enc.encode(ch)); c.close() },
  })
}

let mode = "openai"
;(globalThis as any).fetch = async (url: string) => {
  if (mode === "fail") return new Response("boom", { status: 500 })
  if (url.includes("generativelanguage")) {
    return new Response(sse([
      'data: {"candidates":[{"content":{"parts":[{"text":"Hel"}]}}]}\n',
      'data: {"candidates":[{"content":{"parts":[{"text":"lo G"}]}}]}\n',
      'data: {"candidates":[{"content":{"parts":[{"text":"emini"}]}}]}\n',
    ]), { status: 200 })
  }
  // Deliberately split a JSON payload across two network chunks — the most
  // common real-world streaming bug.
  return new Response(sse([
    'data: {"choices":[{"delta":{"content":"Hel"}}]}\n',
    'data: {"choices":[{"delta":{"con',
    'tent":"lo "}}]}\ndata: {"choices":[{"delta":{"content":"world"}}]}\n',
    'data: [DONE]\n',
  ]), { status: 200 })
}

let ok = true
const check = (l: string, c: boolean, d = "") => { console.log(`  ${c ? "PASS" : "FAIL"}  ${l}  ${d}`); if (!c) ok = false }

async function readAll(res: Response) {
  const r = res.body!.getReader(); const dec = new TextDecoder(); let out = ""
  while (true) { const { done, value } = await r.read(); if (done) break; out += dec.decode(value) }
  return out
}

async function run() {
  process.env.OPENAI_API_KEY = "sk-t"; process.env.GEMINI_API_KEY = "g-t"

  console.log("1) openai streaming")
  usage.length = 0
  const r1 = await streamAI({ task: "tutoring", messages: [{ role: "user", content: "hi" }], userId: "u1" })
  const text1 = await readAll(r1)
  await new Promise(r => setTimeout(r, 30))
  check("assembles deltas in order", text1 === "Hello world", JSON.stringify(text1))
  check("handles JSON split across network chunks", text1.includes("lo "))
  check("[DONE] not emitted as text", !text1.includes("DONE"))
  check("content-type is streaming", r1.headers.get("Content-Type")!.includes("text/plain"))
  check("buffering disabled for proxies", r1.headers.get("X-Accel-Buffering") === "no")

  console.log("\n2) usage logged on completion")
  check("logged once", usage.length === 1, `${usage.length}`)
  check("marked streamed", usage[0].p_metadata.streamed === true)
  check("output tokens estimated", usage[0].p_output_tokens > 0, `${usage[0].p_output_tokens}`)
  check("success true", usage[0].p_success === true)

  console.log("\n3) gemini streaming (long_context layer)")
  usage.length = 0
  process.env.LONG_CONTEXT_VENDOR = "gemini"
  const r2 = await streamAI({ task: "document_analysis", messages: [{ role: "user", content: "doc" }], userId: "u1" })
  check("gemini deltas assembled", (await readAll(r2)) === "Hello Gemini")

  console.log("\n4) upstream failure")
  mode = "fail"; usage.length = 0
  let threw = false
  try { await streamAI({ task: "tutoring", messages: [{ role: "user", content: "x" }] }) } catch { threw = true }
  await new Promise(r => setTimeout(r, 30))
  check("throws on upstream error", threw)
  check("failure logged", usage.length === 1 && usage[0].p_success === false)

  console.log("\n" + "=".repeat(50)); console.log("RESULT:", ok ? "ALL PASS" : "FAILURES"); console.log("=".repeat(50))
}
run().catch(e => { console.error("TEST ERROR:", e) })
