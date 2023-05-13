// grep -o 'RemoteAddr: [0-9\.]\+.*MordhauOnlineSubsystem:[^ ,[:space:]]*' ../Mordhau.log | sed 's/RemoteAddr: \([0-9\.]\+\).*MordhauOnlineSubsystem:\([^ ,[:space:]]*\).*/\1 \2/' | sort -u

const timeProfiler = require('./timeProfiler')
const NetworkUtils = require('./network.js')

const MIN_PING = process.env.MIN_PING ?? 52
const MAX_DELAY_ADDED = process.env.MAX_DELAY_ADDED ?? 50

const cache_playfabToLastDelay = {}

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
  const playfabsToIps = await timeProfiler('Getting IPs', NetworkUtils.getAllPlayfabIps)

  const promises = entries.map(async function ([playfab, ping]) {
    const ip = playfabsToIps[playfab]

    if (!ip || !ip.length) {
      console.log(`Tried to throttle playfab ${playfab} but did not have IP`)
      return
    }

    return { ip, playfab, ping }
  })

  const playerInfoList = await Promise.all(promises)
  return playerInfoList.filter(playerInfo => !!playerInfo)
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

<<<<<<< HEAD:utils/getTrafficRuleUpdates.js
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
=======
    console.log({
      ip: playerInfo.ip,
      playfab: playerInfo.playfab,
      rconPing: playerInfo.ping,
      currentDelay,
      newDelay
    })

    PLAYFAB_TO_LAST_DELAY_CACHE[playerInfo.playfab] = newDelay

    if (newDelay > 0 && playerInfo.playfab == "63E09396DD2B969F") {
      await NetworkUtils.addOrChangeRule(playerInfo.ip, newDelay)
      ipsThrottled.add(playerInfo.ip)
    } else if (ipsThrottled.has(playerInfo.ip)) {
      await NetworkUtils.deleteRule(playerInfo.ip)
      ipsThrottled.delete(playerInfo.ip)
>>>>>>> db127e9f8008f539c964c273dd9c4c4a1bd6616a:utils/updateTrafficRules.js
    }
  })

  const trafficRuleUpdates = await Promise.all(delayPromises)

  return trafficRuleUpdates.filter(function (trafficRuleUpdate) {
    return trafficRuleUpdate !== undefined
  })
}

module.exports = getTrafficRuleUpdates
