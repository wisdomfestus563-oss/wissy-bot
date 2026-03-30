const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion, initAuthCreds } = require('@whiskeysockets/baileys')
const pino = require('pino')
const mongoose = require('mongoose')
const http = require('http')
require('dotenv').config()

const OWNER = process.env.OWNER_NUMBER
const PHONE = process.env.OWNER_NUMBER?.replace('@s.whatsapp.net', '')
let pairingCode = null
let isConnected = false
let isConnecting = false

const authSchema = new mongoose.Schema({ _id: String, data: Object })
const Auth = mongoose.models.Auth || mongoose.model('Auth', authSchema)

async function connectDB() {
  if (mongoose.connection.readyState === 1) return
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('MongoDB connected ✅')
}

async function useMongoAuthState() {
  const writeData = async (data, id) => {
    await Auth.findByIdAndUpdate(id, { data }, { upsert: true, new: true })
  }
  const readData = async (id) => {
    const doc = await Auth.findById(id)
    return doc ? doc.data : null
  }
  const removeData = async (id) => {
    await Auth.deleteOne({ _id: id })
  }
  const creds = await readData('creds')
  const state = {
    creds: creds || initAuthCreds(),
    keys: {
      get: async (type, ids) => {
        const data = {}
        for (const id of ids) {
          data[id] = await readData(`${type}-${id}`)
        }
        return data
      },
      set: async (data) => {
        for (const [type, ids] of Object.entries(data)) {
          for (const [id, val] of Object.entries(ids || {})) {
            if (val) await writeData(val, `${type}-${id}`)
            else await removeData(`${type}-${id}`)
          }
        }
      }
    }
  }
  const saveCreds = async (newCreds) => {
    await writeData(newCreds, 'creds')
  }
  return { state, saveCreds }
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' })
  if (isConnected) {
    res.end(`
      <html>
        <body style="text-align:center;font-family:sans-serif;padding:50px;background:#111;color:#fff">
          <h1>✅ WhatsApp Connected!</h1>
          <p>Wissy Bot is live 24/7 🔥</p>
        </body>
      </html>
    `)
  } else if (pairingCode) {
    res.end(`
      <html>
        <head><meta http-equiv="refresh" content="10"></head>
        <body style="text-align:center;font-family:sans-serif;padding:50px;background:#111;color:#fff">
          <h2>📱 Enter This Code in WhatsApp</h2>
          <p>WhatsApp → Linked Devices → Link a Device → Link with phone number</p>
          <div style="font-size:60px;font-weight:bold;letter-spacing:10px;color:#25D366;margin:30px">${pairingCode}</div>
          <p>Auto-refreshes every 10 seconds</p>
        </body>
      </html>
    `)
  } else {
    res.end(`
      <html>
        <head><meta http-equiv="refresh" content="5"></head>
        <body style="text-align:center;font-family:sans-serif;padding:50px;background:#111;color:#fff">
          <h2>⏳ Starting up...</h2>
          <p>Refresh in 5 seconds</p>
        </body>
      </html>
    `)
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
    const { state, saveCreds } = await useMongoAuthState()
    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: ['Wissy Bot', 'Chrome', '1.0.0'],
    })

    sock.ev.on('creds.update', saveCreds)

    if (!sock.authState.creds.registered) {
      console.log('Requesting pairing code for:', PHONE)
      setTimeout(async () => {
        try {
          pairingCode = await sock.requestPairingCode(PHONE)
          console.log('Pairing code:', pairingCode)
          isConnecting = false
        } catch (e) {
          console.error('Pairing code error:', e.message)
          isConnecting = false
        }
      }, 3000)
    }

    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
      if (connection === 'close') {
        isConnected = false
        isConnecting = false
        const code = lastDisconnect?.error?.output?.statusCode
        if (code !== DisconnectReason.loggedOut) {
          console.log('Reconnecting in 5 seconds...')
          setTimeout(startBot, 5000)
        }
      }
      if (connection === 'open') {
        isConnected = true
        isConnecting = false
        pairingCode = null
        console.log('WhatsApp connected ✅')
      }
    })

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return
      try {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return
        const from = msg.key.remoteJid
        const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
        const isOwner = from === OWNER

        if (from === 'status@broadcast') {
          const { handleStatus } = require('./handlers/statusHandler')
          await handleStatus(sock, msg, OWNER)
          return
        }

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

  } catch (err) {
    console.error('startBot error:', err.message)
    isConnecting = false
    setTimeout(startBot, 10000)
  }
}

startBot()
