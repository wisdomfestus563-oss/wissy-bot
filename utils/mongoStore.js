const mongoose = require('mongoose')

const authSchema = new mongoose.Schema({
  _id: String,
  data: Object
})

const Auth = mongoose.model('Auth', authSchema)

async function getAuthState() {
  const state = { creds: {}, keys: {} }

  const saved = await Auth.findById('creds')
  if (saved) state.creds = saved.data

  const saveCreds = async () => {
    await Auth.findByIdAndUpdate(
      'creds',
      { data: state.creds },
      { upsert: true }
    )
  }

  return { state, saveCreds }
}

module.exports = { getAuthState }
