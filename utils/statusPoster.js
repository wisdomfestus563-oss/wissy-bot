const cron = require('node-cron')

const motivationalStatuses = [
  "Your grind today is your glory tomorrow. Keep pushing! 💪🔥",
  "Every expert was once a beginner. Trust the process. 🌱",
  "Success is not given. It is earned through sweat, focus and sacrifice. 👑",
  "Don't watch the clock. Do what it does — keep going. ⏰",
  "Your only competition is who you were yesterday. 🚀",
  "Small steps every day lead to big results. Stay consistent. 💯",
  "God's timing is perfect. Trust Him even when it's hard. 🙏",
  "The pain you feel today is the strength you feel tomorrow. 💎",
  "Dream big. Start small. Act now. 🌟",
  "You were not created to be average. Rise up! 👆",
  "Every setback is a setup for a comeback. 🔄",
  "Be the energy you want to attract. ✨",
  "Silence is golden when your results do the talking. 🏆",
  "Work in silence. Let your success make the noise. 🔇",
  "One day or day one. You decide. 📅"
]

async function postStatus(sock, ownerJid) {
  try {
    const random = motivationalStatuses[Math.floor(Math.random() * motivationalStatuses.length)]
    await sock.sendMessage(ownerJid, { text: `🌅 *Morning Motivation*\n\n${random}` })
    console.log('Morning status sent ✅')
  } catch (err) {
    console.error('Status post error:', err)
  }
}

function scheduleStatuses(sock, ownerJid) {
  // Every day at 7:00 AM
  cron.schedule('0 7 * * *', () => {
    postStatus(sock, ownerJid)
  }, { timezone: 'Africa/Lagos' })

  console.log('Status scheduler started ✅')
}

module.exports = { scheduleStatuses, postStatus }
