const Anthropic = require('@anthropic-ai/sdk')
const OpenAI = require('openai')
require('dotenv').config()

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const conversationHistory = {}

async function handleAI(sock, msg, from, body) {
  try {
    if (!conversationHistory[from]) conversationHistory[from] = []

    conversationHistory[from].push({ role: 'user', content: body })

    if (conversationHistory[from].length > 20) {
      conversationHistory[from] = conversationHistory[from].slice(-20)
    }

    let reply = ''
    const isDeep = body.length > 100 || body.includes('?') || body.includes('explain') || body.includes('why') || body.includes('how')

    if (isDeep) {
      // Claude for deep questions
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-20250514',
        max_tokens: 1024,
        system: 'You are Wissy Bot, a smart, witty and helpful WhatsApp assistant. Keep responses concise and conversational. You speak naturally.',
        messages: conversationHistory[from]
      })
      reply = response.content[0].text
    } else {
      // GPT for quick replies
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are Wissy Bot, a smart, witty and helpful WhatsApp assistant. Keep responses short and conversational.' },
          ...conversationHistory[from]
        ]
      })
      reply = response.choices[0].message.content
    }

    conversationHistory[from].push({ role: 'assistant', content: reply })

    await sock.sendMessage(from, { text: reply }, { quoted: msg })
  } catch (err) {
    console.error('AI error:', err)
    await sock.sendMessage(from, { text: '⚠️ AI error, try again shortly.' }, { quoted: msg })
  }
}

module.exports = { handleAI }
