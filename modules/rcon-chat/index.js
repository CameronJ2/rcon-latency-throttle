const { Rcon } = require('rcon-client')
const throttler = require('../../modules/throttler')
const trafficRuleUpdater = require('../throttler/utils/getTrafficRuleUpdates')

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

const start = async function () {
  const rcon = await getRcon()

  const authorizedPlayfabs = new Set(['59BB3CF55044CB94', '8770BD43A33505C0', '63E09396DD2B969F'])

  try {
    const sendCommand = await rcon.send('listen chat')
    console.log({ sendCommand })

    rcon.send('info').then(console.log)

    rcon.socket.on('data', function (buffer) {
      console.log({ fullmsg: formatString(buffer.toString()) })
      const formattedString = formatString(buffer.toString())
      const [unformattedPlayfab, name, userMessage] = formattedString
        .split(',')
        .map(val => val.trim())

      console.log({ unformattedPlayfab, name, userMessage })
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

      if (minPing === 0) {
        throttler.teardownProcesses()
        return rcon.send(`say Throttling disabled`)
      }

      console.log(`Valid min ping provided: ${minPing}`)
      trafficRuleUpdater.setMinPing(minPing)
      rcon.send(`say Setting minimum ping to ${minPing}`)
    })

    rcon.on('error', function (err) {
      console.log({ rconError: err })
    })
  } catch (err) {
    console.error({ err })
  }
}

throttler.startupProcesses()

module.exports = { start }
