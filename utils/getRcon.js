const { Rcon } = require('rcon-client')

let cached_rcon = null

/**
 * Function that connects to rcon and returns the rcon object
 */
const getRcon = async function (reconnect = false) {
  if (cached_rcon && cached_rcon.authenticated && !reconnect) {
    console.log('Returning cached rcon...')
    return cached_rcon
  }

  console.log('Attempting connection to rcon...')

  const { RCON_HOST, RCON_PORT, RCON_PASSWORD } = process.env

  if (!RCON_HOST || !RCON_PORT || !RCON_PASSWORD) {
    throw new Error('Not all RCON environment variables have been set up')
  }

  const rconPromise = Rcon.connect({
    host: process.env.RCON_HOST,
    port: process.env.RCON_PORT,
    password: process.env.RCON_PASSWORD
  })

  const timeoutPromise = new Promise((resolve, reject) => setTimeout(reject, 5000))

  try {
    cached_rcon = await Promise.race([rconPromise, timeoutPromise])

    cached_rcon.on('error', err => {
      console.log('RCON connection emmitted error event:', err)
      cached_rcon = null
    })
  } catch (err) {
    console.error('RCON connection timed out, retrying', err)
    return getRcon(true)
  }

  console.log('Connected to RCON')
  return cached_rcon
}

module.exports = getRcon
