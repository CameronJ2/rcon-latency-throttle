const { Rcon } = require('rcon-client')

let cached_rcon = null

/**
 * Function that connects to rcon and returns the rcon object
 */
const getRcon = async function (reconnect = false, wait = 0) {
  if (cached_rcon && cached_rcon.authenticated && !reconnect) {
    logInfo('Returning cached rcon...')
    return cached_rcon
  }

  if (wait > 0) {
    await new Promise(resolve => setTimeout(resolve, wait))
  }

  logInfo('Attempting connection to rcon...')
  cached_rcon = null

  const { RCON_HOST, RCON_PORT, RCON_PASSWORD } = process.env

  if (!RCON_HOST || !RCON_PORT || !RCON_PASSWORD) {
    throw new Error('Not all RCON environment variables have been set up')
  }

  const rconPromise = Rcon.connect({
    host: process.env.RCON_HOST,
    port: process.env.RCON_PORT,
    password: process.env.RCON_PASSWORD
  })

  const timeoutPromise = new Promise((resolve, reject) => {
    setTimeout(() => {
      reject()
    }, 5000)
  })

  try {
    cached_rcon = await Promise.race([rconPromise, timeoutPromise])
    cached_rcon.on('error', err => {
      logInfo('RCON connection emmitted error event:', err)
      cached_rcon = null
    })
    cached_rcon.on('end', err => {
      logInfo('RCON connection emmitted end event')
      cached_rcon = null
    })
  } catch (err) {
    logError('RCON connection timed out, retrying in 10 seconds...', err)
    return getRcon(true, 10000)
  }

  logInfo('Connected to RCON')
  return cached_rcon
}

module.exports = getRcon
