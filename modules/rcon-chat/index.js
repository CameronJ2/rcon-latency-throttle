const getRcon = require('../../utils/getRcon')
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

const authorizedPlayfabs = new Set(['59BB3CF55044CB94', '8770BD43A33505C0', '63E09396DD2B969F'])

const start = async function () {
  const rcon = await getRcon(true)

  const handleOnData = async function (buffer) {
    const formattedString = formatString(buffer.toString())

    const [unformattedPlayfab, name, userMessage] = formattedString
      .split(',')
      .map(val => val.trim())

    if (!unformattedPlayfab || !userMessage) {
      return
    }

    const formattedPlayfab = unformattedPlayfab.split(' ')[1]

    // Step 1 - check if command is valid
    if (!userMessage.startsWith('.throttle ')) {
      return logInfo(`Skipping message "${userMessage}"`)
    }

    // Step 2 - check if user is authorized
    if (!authorizedPlayfabs.has(formattedPlayfab)) {
      return logError(`Player ${name}(${formattedPlayfab}) is unauthorized`)
    }

    logInfo(`Player ${name}(${formattedPlayfab}) is authorized!`)

    // Step 3 - check if user provided a valid number
    const [_, minPing] = userMessage.split(' ')
    const minPingAsNum = Number.parseInt(minPing)
    if (Number.isNaN(minPingAsNum)) {
      return logError(`Invalid min ping provided: ${minPing}`)
    }

    if (minPingAsNum === 0) {
      throttler.teardownProcesses()
      return rcon.send(`say Throttling disabled`)
    }

    trafficRuleUpdater.setMinPing(minPingAsNum)
    logInfo(`Valid min ping provided: ${minPing}`)

    if (global.hasProgramTerminated) {
      await throttler.startupProcesses()
    }

    rcon.send(`say Setting minimum ping to ${minPing}`)
  }

  try {
    await rcon.send('listen chat')
    rcon.send('info').then(logInfo)
    rcon.socket.on('data', handleOnData)
  } catch (err) {
    logError({ err })
  } finally {
    setTimeout(async () => {
      await rcon?.end().catch(logError)
      start()
    }, 30000)
  }
}

throttler.startupProcesses()

module.exports = { start }
