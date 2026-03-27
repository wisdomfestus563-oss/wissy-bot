const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const pino = require('pino')
const mongoose = require('mongoose')
const http = require('http')
require('dotenv').config()

const OWNER = process.env.OWNER_NUMBER
let lastQR = null
let isConnected = false
let isConnecting = false

// DB
const authSchema = new mongoose.Schema({ _id: String, data: Object })
const Auth = mongoose.models.Auth || mongoose.model('Auth', authSchema)

async function connectDB() {
  if (mongoose.connection.readyState === 1) return
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('MongoDB connected ✅')
}

// Web server
const server = http.createServer((req, res) => {
  if (req.url === '/qr') {
    if (isConnected) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<h1 style="font-family:sans-serif;text-align:center;padding:50px">✅ WhatsApp Connected!</h1>')
    } else if (lastQR) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`
        <html>
          <head>
            <title>Wissy Bot QR</title>
            <meta http-equiv="refresh" content="30">
          </head>
          <body style="text-align:center;font-family:sans-serif;padding:40px;background:#111;color:#fff">
            <h2>📱 Scan This QR Code</h2>
            <p>WhatsApp → Linked Devices → Link a Device</p>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(lastQR)}" style="border:10px solid white;border-radius:10px"/>
            <p>Page auto-refreshes every 30 seconds</p>
          </body>
        </html>
      `)
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<h1 style="font-family:sans-serif;text-align:center;padding:50px;background:#111;color:#fff">⏳ Starting up... Refresh in 10 seconds</h1>')
    }
  } else {
    res.writeHead(200)
    res.end('Wissy Bot Running ✅')
  }
})

server.listen(process.env.PORT || 3000, () => {
  console.log('Web server running ✅')
})

async function startBot() {
  if (isConnecting) return
  isConnecting = true

  try {
    await connectDB()

    const saved = await Auth.findById('creds')
    const creds = saved ? saved.data : undefined

    const state = {
      creds: creds || {},
      keys: {}
    }

    const saveCreds = async () => {
      try {
        await Auth.findByIdAndUpdate('creds', { data: state.creds }, { upsert: true })
      } catch (e) {
        console.error('Save error:', e.message)
      }
    }

    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
    })

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        lastQR = qr
        isConnecting = false
        console.log('QR generated — visit /qr to scan')
      }

      if (connection === 'close') {
        isConnected = false
        isConnecting = false
        const code = lastDisconnect?.error?.output?.statusCode
        console.log('Connection closed, code:', code)

        if (code !== DisconnectReason.loggedOut) {
          console.log('Reconnecting in 5 seconds...')
          setTimeout(startBot, 5000)
        } else {
          console.log('Logged out!')
        }
      }

      if (connection === 'open') {
        isConnected = true
        isConnecting = false
        lastQR = null
        console.log('WhatsApp connected ✅')
      }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
      try {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return
        const from = msg.key.remoteJid
        const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
        const isOwner = from === OWNER

        if (body.startsWith('!')) {
          const { handleCommand } = require('./handlers/commandHandler')
          await handleCommand(sock, msg, from, body, isOwner, OWNER)
        } else if (body) {
          const { handleAI } = require('./handlers/aiHandler')
          await handleAI(sock, msg, from, body)
        }
      } catch (e) {
        console.error('Message error:', e.message)
      }
    })

    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        if (msg.key.remoteJid === 'status@broadcast') {
          try {
            const { handleStatus } = require('./handlers/statusHandler')
            await handleStatus(sock, msg, OWNER)
          } catch (e) {
            console.error('Status error:', e.message)
          }
        }
      }
    })

  } catch (err) {
    console.error('Bot error:', err.message)
    isConnecting = false
    console.log('Retrying in 10 seconds...')
    setTimeout(startBot, 10000)
  }
}

startBot()
