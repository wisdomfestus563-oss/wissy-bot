const { postStatus } = require('../utils/statusPoster')
const { forwardStatuses } = require('./statusHandler')
require('dotenv').config()

async function handleCommand(sock, msg, from, body, isOwner, ownerJid) {
  const cmd = body.trim().toLowerCase().split(' ')[0]

  switch (cmd) {
    case '!menu':
    case '!help':
      await sock.sendMessage(from, {
        text: `🤖 *Wissy Bot Commands*\n\n` +
          `!menu — Show this menu\n` +
          `!statuses — Forward all saved statuses to your DM\n` +
          `!poststatus — Post a motivational status now\n` +
          `!ping — Check if bot is alive\n` +
          `!clear — Clear your AI chat history\n\n` +
          `💬 Just chat normally for AI replies!`
      }, { quoted: msg })
      break

    case '!ping':
      await sock.sendMessage(from, { text: '🟢 Bot is alive and running!' }, { quoted: msg })
      break

    case '!poststatus':
      if (!isOwner) {
        await sock.sendMessage(from, { text: '❌ Only owner can use this command.' }, { quoted: msg })
        return
      }
      await postStatus(sock, ownerJid)
      await sock.sendMessage(from, { text: '✅ Motivational status posted!' }, { quoted: msg })
      break

    case '!statuses':
      if (!isOwner) {
        await sock.sendMessage(from, { text: '❌ Only owner can use this command.' }, { quoted: msg })
        return
      }
      await forwardStatuses(sock, ownerJid)
      break

    case '!clear':
      await sock.sendMessage(from, { text: '🧹 Chat history cleared!' }, { quoted: msg })
      break

    default:
      await sock.sendMessage(from, { text: `❓ Unknown command. Type *!menu* to see all commands.` }, { quoted: msg })
  }
}

module.exports = { handleCommand }
