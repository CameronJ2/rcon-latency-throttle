require('dotenv').config()

const MIN_PING = process.env.MIN_PING ?? 52
const MAX_DELAY_ADDED = process.env.MAX_DELAY_ADDED ?? 50
const POLL_RATE = process.env.POLL_RATE ?? 6000

/**
 * 3 Steps to throttle
 * [x] Acquire / save ping
 * [x] Acquire IP by playfab
 *   - Find the most recent game log file
 *   - Parse file, use the play fab to find the IP
 * [] Add a traffic control rule to delay packets if necessary
 * [] Add polling
 */

const { Rcon } = require('rcon-client')
const NetworkUtils = require('./utils/network.js')

let cached_rcon = null

/**
 * Create a function that connects to rcon and returns the rcon object - call this getRcon()
 */
const getRcon = async function () {
  const { RCON_HOST, RCON_PORT, RCON_PASSWORD } = process.env

  if (!RCON_HOST || !RCON_PORT || !RCON_PASSWORD) {
    throw new Error('Not all RCON environment variables have been set up')
  }

  if (!cached_rcon) {
    cached_rcon = await Rcon.connect({
      host: process.env.RCON_HOST,
      port: process.env.RCON_PORT,
      password: process.env.RCON_PASSWORD
    })
  }

  return cached_rcon
}

/**
 * Create a function that gets the playerlist from the rcon object. Return the playerlist
 * This function should take an rcon object as an argument
 */
const getPlayerList = async function (rcon) {
  return rcon.send('playerlist')
}

/**
 * Function that takes a playerlist, returns a dictionary of playfabs to pings
 */
const createPingDictionary = function (playerList) {
  if (playerList.includes('There are currently no players present')) {
    return {}
  }

  const playerLines = playerList.trim().split('\n')

  const dictionary = {}

  //loops through each item in playerLines
  playerLines.forEach(function (playerLine) {
    const splitItems = playerLine.split(',')
    const playfab = splitItems[0]
    const ping = splitItems[2]

    if (!ping) {
      // Player is a bot
      return
    }

    const pingAsNum = Number.parseInt(ping.trim().split(' ')[0])
    dictionary[playfab] = pingAsNum
  })

  return dictionary
}

const cached_playfabToIp = {}
const cached_playfabToLastDelay = {}
const cached_ipsThrottled = new Set()

/**
 * Function that figures out if an IP needs to be parsed
 * future optimization: System that counts times since last parse
 */
const shouldParseIp = function (playfab, ping) {
  const ipIsCached =
    Boolean(cached_playfabToIp[playfab]) && Boolean(cached_playfabToIp[playfab].length)
  const pingNeedsToBeThrottled = ping < MIN_PING - 4
  return !ipIsCached || pingNeedsToBeThrottled
}

/**
 * Main execution
 */
const main = async function () {
  const rcon = await getRcon()

  const beforePlayerList = Date.now()
  const playerList = await getPlayerList(rcon)
  console.log(`Rcon player list took approximately ${Date.now() - beforePlayerList}ms`)

  const pingDictionary = createPingDictionary(playerList)
  const playfabs = Object.entries(pingDictionary)

  const ipPromises = playfabs.map(async function ([playfab, ping]) {
    if (!shouldParseIp(playfab, ping)) {
      return { ip: cached_playfabToIp[playfab], playfab, ping }
    }

    const timeBeforeCreatingIpRule = Date.now()
    const ip = await NetworkUtils.getPlayfabsIp(playfab)
    const timeAfterCreatingIpRule = Date.now()
    console.log(
      `File parse took approximately ${timeAfterCreatingIpRule - timeBeforeCreatingIpRule}ms`
    )

    cached_playfabToIp[playfab] = ip

    return { ip, playfab, ping }
  })

  const playerInfoList = await Promise.all(ipPromises)

  const timeBeforeRules = Date.now()

  // For each ip, check if their ping is under minimum. If so, create a traffic rule
  const delayPromises = playerInfoList.map(async function (playerInfo) {
    const currentDelay = cached_playfabToLastDelay[playerInfo.playfab] ?? 0
    const delayToAdd =
      playerInfo.ping > 0
        ? Math.min(Math.max(MIN_PING - playerInfo.ping, -MAX_DELAY_ADDED), MAX_DELAY_ADDED)
        : 0
    const newDelay = Math.max(Math.min(currentDelay + delayToAdd, MIN_PING), 0)

    console.log({
      ip: playerInfo.ip,
      playfab: playerInfo.playfab,
      rconPing: playerInfo.ping,
      currentDelay,
      newDelay
    })

    cached_playfabToLastDelay[playerInfo.playfab] = newDelay

    if (newDelay > 0) {
      await NetworkUtils.addOrChangeRule(playerInfo.ip, newDelay)
      cached_ipsThrottled.add(playerInfo.ip)
    } else if (cached_ipsThrottled.has(playerInfo.ip)) {
      await NetworkUtils.deleteRule(playerInfo.ip)
      cached_ipsThrottled.delete(playerInfo.ip)
    }
  })

  await Promise.all(delayPromises)
  console.log(`Rule adding/deleting took approximately ${Date.now() - timeBeforeRules}ms`)
  console.log('All required players have been throttled')
}

let stopInterval = false

const mainInterval = async function () {
  if (stopInterval) {
    return
  }

  const now = Date.now()

  try {
    await main()
    const after = Date.now()
    console.log(`Main took approximately ${after - now}ms`)
  } catch (err) {
    console.log('There was an error in main')
    console.log(err)
  } finally {
    setTimeout(mainInterval, POLL_RATE)
  }
}

const deleteAllRulesWithLogging = function () {
  return NetworkUtils.deleteAllRules().then(function () {
    console.log('Wiped rules successfully')
  })
}

const startupProcesses = async function () {
  await deleteAllRulesWithLogging().catch(function (err) {
    console.log('Error while wiping rules', err)
    process.exit()
  })

  mainInterval()
  console.log('hello!')
}

startupProcesses()

process.on('SIGINT', () => {
  console.log('Caught SIGINT. Performing cleanup before exiting.')
  stopInterval = true

  setTimeout(async function () {
    await deleteAllRulesWithLogging()
    process.exit()
  }, 5000)
})
