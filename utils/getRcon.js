const { Rcon } = require('rcon-client')

/**
 * Function that connects to rcon and returns the rcon object
 */
const getRcon = async function (wait = 0) {
  if (wait > 0) {
    logInfo('Waiting...')
    await new Promise(resolve => setTimeout(resolve, wait))
  }

  logInfo('Attempting connection to rcon...')

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
    const rcon = await Promise.race([rconPromise, timeoutPromise])
    rcon.on('error', async err => {
      logError('RCON connection emmitted error event:', err)
      await rcon?.socket?.removeAllListeners?.()?.catch?.(logError)
      await rcon?.socket?.destroy?.()?.catch?.(logError)
    })
    rcon.on('end', async event => {
      logInfo('RCON connection emmitted end event', event)
      await rcon?.socket?.removeAllListeners?.()?.catch?.(logError)
      await rcon?.socket?.destroy?.()?.catch?.(logError)
    })

    logInfo('Connected to RCON')
    return rcon
  } catch (err) {
    logError('RCON connection timed out, retrying in 10 seconds...', err)
    return getRcon(10000)
  }
}

module.exports = getRcon
