const savedStatuses = []

async function handleStatus(sock, msg, ownerJid) {
  try {
    const content = msg.message

    if (content?.imageMessage) {
      savedStatuses.push({ type: 'image', msg })
      console.log('Status image saved ✅')
    } else if (content?.videoMessage) {
      savedStatuses.push({ type: 'video', msg })
      console.log('Status video saved ✅')
    } else if (content?.conversation || content?.extendedTextMessage) {
      const text = content?.conversation || content?.extendedTextMessage?.text
      savedStatuses.push({ type: 'text', text, msg })
      console.log('Status text saved ✅')
    }
  } catch (err) {
    console.error('Status handler error:', err)
  }
}

async function forwardStatuses(sock, ownerJid) {
  try {
    if (savedStatuses.length === 0) {
      await sock.sendMessage(ownerJid, { text: '📭 No statuses saved yet.' })
      return
    }

    await sock.sendMessage(ownerJid, { text: `📬 Forwarding *${savedStatuses.length}* saved status(es)...` })

    for (const status of savedStatuses) {
      try {
        if (status.type === 'text') {
          await sock.sendMessage(ownerJid, { text: `📝 Status:\n\n${status.text}` })
        } else {
          await sock.copyNForward(ownerJid, status.msg, true)
        }
      } catch (e) {
        console.error('Forward error:', e)
      }
    }

    savedStatuses.length = 0
    await sock.sendMessage(ownerJid, { text: '✅ All statuses forwarded and cleared!' })
  } catch (err) {
    console.error('Forward statuses error:', err)
    await sock.sendMessage(ownerJid, { text: '⚠️ Error forwarding statuses.' })
  }
}

module.exports = { handleStatus, forwardStatuses }
