const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const pino = require('pino')
const mongoose = require('mongoose')
const http = require('http')
const qrcode = require('qrcode-terminal')
const { handleCommand } = require('./handlers/commandHandler')
const { handleAI } = require('./handlers/aiHandler')
const { handleStatus } = require('./handlers/statusHandler')
const { scheduleStatuses } = require('./utils/statusPoster')
const { getAuthState } = require('./utils/mongoStore')
require('dotenv').config()

const OWNER = process.env.OWNER_NUMBER
let lastQR = null
let isConnected = false

const server = http.createServer((req, res) => {
  if (req.url === '/qr') {
    if (isConnected) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<h1>✅ WhatsApp Already Connected!</h1>')
    } else if (lastQR) {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`
        <html>
          <head><title>Wissy Bot QR</title></head>
          <body style="text-align:center;font-family:sans-serif;padding:40px">
            <h2>📱 Scan This QR Code With WhatsApp</h2>
            <p>Open WhatsApp → Linked Devices → Link a Device</p>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(lastQR)}" />
            <p>Refresh if expired</p>
          </body>
        </html>
      `)
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<h1>⏳ Generating QR... Refresh in 5 seconds</h1>')
    }
  } else {
    res.writeHead(200)
    res.end('Wissy Bot Running ✅')
  }
})

server.listen(process.env.PORT || 3000, () => {
  console.log('Server running ✅')
})

async function connectToWhatsApp() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('MongoDB connected ✅')

  const { state, saveCreds } = await getAuthState()
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
      console.log('QR ready — visit /qr to scan')
    }
    if (connection === 'close') {
      isConnected = false
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      if (shouldReconnect) connectToWhatsApp()
    } else if (connection === 'open') {
      isConnected = true
      lastQR = null
      console.log('WhatsApp connected ✅')
      scheduleStatuses(sock, OWNER)
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return
    const from = msg.key.remoteJid
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const isOwner = from === OWNER
    if (body.startsWith('!')) {
      await handleCommand(sock, msg, from, body, isOwner, OWNER)
    } else if (body) {
      await handleAI(sock, msg, from, body)
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.remoteJid === 'status@broadcast') {
        await handleStatus(sock, msg, OWNER)
      }
    }
  })
}

connectToWhatsApp()
