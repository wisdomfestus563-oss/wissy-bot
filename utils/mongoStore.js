const mongoose = require('mongoose')

const authSchema = new mongoose.Schema({
  _id: String,
  data: Object
})

const Auth = mongoose.models.Auth || mongoose.model('Auth', authSchema)

let isConnected = false

async function connectDB() {
  if (isConnected) return
  await mongoose.connect(process.env.MONGODB_URI)
  isConnected = true
  console.log('MongoDB connected ✅')
}

async function getAuthState() {
  await connectDB()

  const state = { creds: {}, keys: {} }

  try {
    const saved = await Auth.findById('creds')
    if (saved) state.creds = saved.data
  } catch (e) {
    console.log('No saved creds, fresh start')
  }

  const saveCreds = async () => {
    try {
      await Auth.findByIdAndUpdate(
        'creds',
        { data: state.creds },
        { upsert: true }
      )
    } catch (e) {
      console.error('Save creds error:', e)
    }
  }

  return { state, saveCreds }
}

module.exports = { getAuthState }
