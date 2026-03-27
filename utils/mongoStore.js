const mongoose = require('mongoose')

const authSchema = new mongoose.Schema({ _id: String, data: Object })
const Auth = mongoose.models.Auth || mongoose.model('Auth', authSchema)

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

  return {
    state: {
      creds: creds || {},
      keys: {
        get: async (type, ids) => {
          const data = {}
          for (const id of ids) {
            const val = await readData(`${type}-${id}`)
            data[id] = val
          }
          return data
        },
        set: async (data) => {
          for (const [type, ids] of Object.entries(data)) {
            for (const [id, val] of Object.entries(ids)) {
              if (val) {
                await writeData(val, `${type}-${id}`)
              } else {
                await removeData(`${type}-${id}`)
              }
            }
          }
        }
      }
    },
    saveCreds: async () => {
      await writeData(sock.authState.creds, 'creds')
    }
  }
}

module.exports = { useMongoAuthState }
