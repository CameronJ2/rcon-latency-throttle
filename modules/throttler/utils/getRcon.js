const { Rcon } = require('rcon-client')

let cached_rcon = null

/**
 * Function that connects to rcon and returns the rcon object
 */
module.exports = async function () {
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
