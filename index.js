const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const pino = require('pino')
const mongoose = require('mongoose')
const { handleCommand } = require('./handlers/commandHandler')
const { handleAI } = require('./handlers/aiHandler')
const { handleStatus, forwardStatuses } = require('./handlers/statusHandler')
const { scheduleStatuses } = require('./utils/statusPoster')
const { getAuthState } = require('./utils/mongoStore')
const qrcode = require('qrcode-terminal')
require('dotenv').config()

const OWNER = process.env.OWNER_NUMBER

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
      console.log('==== SCAN THIS QR CODE ====')
      qrcode.generate(qr, { small: true })
      console.log('===========================')
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      if (shouldReconnect) connectToWhatsApp()
    } else if (connection === 'open') {
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
