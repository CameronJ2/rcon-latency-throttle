const { Rcon } = require('rcon-client')
const { createInstance } = require('../../modules/throttler')

const formatString = function (string) {
  return string
    .split('')
    .reduce((acc, val) => {
      const charCode = val.charCodeAt(0)

      if (charCode >= 32 && charCode <= 126) {
        acc += val
      }

      return acc
    }, '')
    .trim()
    .replace(/ *\([^)]*\) */, ' ')
}

let cached_rcon = null

const getRcon = async function () {
  if (cached_rcon) {
    return cached_rcon
  }

  const { RCON_HOST, RCON_PORT, RCON_PASSWORD } = process.env

  if (!RCON_HOST || !RCON_PORT || !RCON_PASSWORD) {
    throw new Error('Not all RCON environment variables have been set up')
  }

  cached_rcon = await Rcon.connect({
    host: process.env.RCON_HOST,
    port: process.env.RCON_PORT,
    password: process.env.RCON_PASSWORD
  })

  return cached_rcon
}

let lastInstance = null

const start = async function () {
  const rcon = await getRcon()

  const authorizedPlayfabs = new Set(['59BB3CF55044CB94'])

  try {
    const sendCommand = await rcon.send('listen chat')
    console.log({ sendCommand })

    rcon.send('info').then(console.log)

    rcon.socket.on('data', async function (buffer) {
      const formattedString = formatString(buffer.toString())
      const [unformattedPlayfab, name, userMessage] = formattedString
        .split(',')
        .map(val => val.trim())
      const formattedPlayfab = unformattedPlayfab.split(' ')[1]

      // Step 1 - check if command is valid
      if (!userMessage.startsWith('.throttle ')) {
        return console.log(`Skipping message "${userMessage}"`)
      }

      // Step 2 - check if user is authorized
      if (!authorizedPlayfabs.has(formattedPlayfab)) {
        return console.error(`Player ${name}(${formattedPlayfab}) is unauthorized`)
      }

      console.log(`Player ${name}(${formattedPlayfab}) is authorized!`)

      // Step 3 - check if user provided a valid number
      const [_, minPing] = userMessage.split(' ')
      const minPingAsNum = Number.parseInt(minPing)
      if (Number.isNaN(minPingAsNum)) {
        return console.error(`Invalid min ping provided: ${minPing}`)
      }

      console.log(`Valid min ping provided: ${minPing}`)
      const throttlerInstance = createInstance()

      if (lastInstance) {
        await lastInstance.teardownProcesses()
      }

      throttlerInstance.startupProcesses(minPingAsNum)
      lastInstance = throttlerInstance
    })

    rcon.on('error', function (err) {
      console.log({ rconError: err })
    })
  } catch (err) {
    console.error({ err })
  }
}

module.exports = { start }
