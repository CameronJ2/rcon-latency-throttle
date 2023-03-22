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
 * [x] Add a traffic control rule to delay packets if necessary
 * [x] Add polling
 */

const { Rcon } = require('rcon-client')
const NetworkUtils = require('./utils/network.js')
const timeProfiler = require('./utils/timeProfiler')

/**
 * Function that connects to rcon and returns the rcon object
 */
let cached_rcon = null
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
 * Function that gets the playerlist from the rcon object. Return the playerlist
 */
const getPlayerList = async function (rcon) {
  return rcon.send('playerlist')
}

/**
 * Function that takes a playerlist, returns a dictionary of playfabs to pings
 * ie:
 *  {
 *    'DreamsPlayfab': 44
 *  }
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

    if (ping === undefined) {
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

/**
 * Function that figures out if an IP needs to be parsed
 */
const shouldParseIp = function (playfab, ping) {
  const ipIsCached =
    Boolean(cached_playfabToIp[playfab]) && Boolean(cached_playfabToIp[playfab].length)
  const pingNeedsToBeThrottled = ping < MIN_PING - 4
  return !ipIsCached || pingNeedsToBeThrottled
}

/**
 * Parses Mordhau.log for player ips, and returns an array of dictionaries { ip, playfab, ping }
 * @param {object} pingDictionary - dictionary of playfabs to ping { 'DreamsPlayfab': 44 }
 * @returns [{ 'DreamsPlayfab': 'kj251jk512', ip: '111.111.111.11', ping: 50 }]
 */
const getPlayerInfoList = function (pingDictionary) {
  const entries = Object.entries(pingDictionary)

  const promises = entries.map(async function ([playfab, ping]) {
    if (!shouldParseIp(playfab, ping)) {
      return { ip: cached_playfabToIp[playfab], playfab, ping }
    }

    const ip = await timeProfiler('File parse', function () {
      return NetworkUtils.getPlayfabsIp(playfab)
    })

    cached_playfabToIp[playfab] = ip
    return { ip, playfab, ping }
  })

  return Promise.all(promises)
}

/**
 * Creates/deletes traffic rules depending on logic for each player
 * @param {*} playerInfoList - should be in format [{ 'DreamsPlayfab': 'kj251jk512', ip: '111.111.111.11', ping: 50 }]
 */
const delayPlayers = function (playerInfoList) {
  const ipsThrottled = new Set()

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
      ipsThrottled.add(playerInfo.ip)
    } else if (ipsThrottled.has(playerInfo.ip)) {
      await NetworkUtils.deleteRule(playerInfo.ip)
      ipsThrottled.delete(playerInfo.ip)
    }
  })

  return Promise.all(delayPromises)
}

/**
 * Main execution
 */
const main = async function () {
  const rcon = await getRcon()

  const playerList = await timeProfiler('Rcon player list', function () {
    return getPlayerList(rcon)
  })

  const pingDictionary = createPingDictionary(playerList)
  const playerInfoList = await getPlayerInfoList(pingDictionary)

  await timeProfiler('Rule adding/deleting', function () {
    return delayPlayers(playerInfoList)
  })

  console.log('All required players have been throttled')
}

let stopInterval = false

const mainInterval = async function () {
  if (stopInterval) {
    return
  }

  try {
    await timeProfiler('Main', main)
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
