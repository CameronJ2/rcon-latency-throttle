// grep -o 'RemoteAddr: [0-9\.]\+.*MordhauOnlineSubsystem:[^ ,[:space:]]*' ../Mordhau.log | sed 's/RemoteAddr: \([0-9\.]\+\).*MordhauOnlineSubsystem:\([^ ,[:space:]]*\).*/\1 \2/' | sort -u

const timeProfiler = require('./timeProfiler')
const NetworkUtils = require('./network.js')

const MIN_PING = process.env.MIN_PING ?? 52
const MAX_DELAY_ADDED = process.env.MAX_DELAY_ADDED ?? 50

const cache_playfabToIp = {}
const cache_playfabToLastDelay = {}

/**
 * Function that figures out if an IP needs to be parsed
 */
const shouldParseIp = function (ping, minPing = MIN_PING) {
  return ping < minPing - 4
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

/**
 * Parses Mordhau.log for player ips, and returns an array of dictionaries { ip, playfab, ping }
 * @param {object} rcon - rcon object
 * @returns [{ 'DreamsPlayfab': 'kj251jk512', ip: '111.111.111.11', ping: 50 }]
 */
const getPlayerInfoList = async function (rcon) {
  const playerList = await timeProfiler('Rcon player list', function () {
    return getPlayerList(rcon)
  })

  const pingDictionary = createPingDictionary(playerList)

  const entries = Object.entries(pingDictionary)

  const promises = entries.map(async function ([playfab, ping]) {
    const cachedIp = cache_playfabToIp[playfab]

    if (cachedIp?.length && !shouldParseIp(playfab, ping)) {
      return { ip: cachedIp, playfab, ping }
    }

    const ip = await timeProfiler('File parse', function () {
      return NetworkUtils.getPlayfabsIp(playfab)
    })

    cache_playfabToIp[playfab] = ip
    return { ip, playfab, ping }
  })

  return Promise.all(promises)
}

/**
 * Creates/deletes traffic rules depending on logic for each player
 * @param {rcon} - rcon object
 */
const getTrafficRuleUpdates = async function (rcon) {
  const playerInfoList = await getPlayerInfoList(rcon)

  // For each ip, check if their ping is under minimum. If so, create a traffic rule
  const delayPromises = playerInfoList.map(async function (playerInfo) {
    const currentDelay = cache_playfabToLastDelay[playerInfo.playfab] ?? 0
    const delayToAdd =
      playerInfo.ping > 0
        ? Math.min(Math.max(MIN_PING - playerInfo.ping, -MAX_DELAY_ADDED), MAX_DELAY_ADDED)
        : 0
    const newDelay = Math.max(Math.min(currentDelay + delayToAdd, MIN_PING), 0)

    // console.log({
    //   ip: playerInfo.ip,
    //   playfab: playerInfo.playfab,
    //   rconPing: playerInfo.ping,
    //   currentDelay,
    //   newDelay
    // })

    cache_playfabToLastDelay[playerInfo.playfab] = newDelay

    if (newDelay > 0 && currentDelay !== newDelay) {
      return { ip: playerInfo.ip, delay: newDelay }
    }
  })

  const trafficRuleUpdates = await Promise.all(delayPromises)

  return trafficRuleUpdates.filter(function (trafficRuleUpdate) {
    return trafficRuleUpdate !== undefined
  })
}

module.exports = getTrafficRuleUpdates
