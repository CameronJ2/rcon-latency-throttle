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

const authorizedPlayfabs = new Set([
  '59BB3CF55044CB94',
  '8770BD43A33505C0',
  '63E09396DD2B969F',
  'AA6380B4A04CCA37'
])

let cachedRcon = null

const handleOnData = async function (buffer) {
  if (!cachedRcon?.authenticated) {
    return
  }

  const formattedString = formatString(buffer.toString())

  console.log({ formattedString })

  const [unformattedPlayfab, name, userMessage] = formattedString.split(',').map(val => val.trim())

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

  await throttler.teardownProcesses()

  if (minPingAsNum === 0) {
    return cachedRcon.send(`say Throttling disabled`)
  }

  trafficRuleUpdater.setMinPing(minPingAsNum)
  logInfo(`Valid min ping provided: ${minPing}`)

  if (global.hasProgramTerminated) {
    await throttler.startupProcesses()
  }

  cachedRcon.send(`say Setting minimum ping to ${minPing}`)
}

const start = async function () {
  try {
    if (!cachedRcon?.authenticated) {
      logInfo('RCON Module - RCON not connected, attempting reconnect...')
      await cachedRcon?.end()?.catch(logError)
      cachedRcon = null
      cachedRcon = await getRcon()
    }

    await cachedRcon.send('listen chat')
    cachedRcon.send('info').then(logInfo)
    cachedRcon.socket.on('data', handleOnData)
  } catch (err) {
    logError('RCON Module - Error in start function', err)
    await cachedRcon?.end()?.catch(logError)
  } finally {
    setTimeout(() => {
      start()
    }, 30000)
  }
}

throttler.startupProcesses()

module.exports = { start }
