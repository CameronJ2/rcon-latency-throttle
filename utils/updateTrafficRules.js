const timeProfiler = require('./timeProfiler')
const NetworkUtils = require('./network.js')
const Queue = require('./Queue')

const MIN_PING = process.env.MIN_PING ?? 52
const MAX_DELAY_ADDED = process.env.MAX_DELAY_ADDED ?? 50

const PLAYFAB_TO_IP_CACHE = {}
const PLAYFAB_TO_LAST_DELAY_CACHE = {}

/**
 * Function that figures out if an IP needs to be parsed
 */
const shouldParseIp = function (playfab, ping) {
  const ipIsCached = Boolean(PLAYFAB_TO_IP_CACHE[playfab] && PLAYFAB_TO_IP_CACHE[playfab].length)
  const pingNeedsToBeThrottled = ping < MIN_PING - 4
  return !ipIsCached || pingNeedsToBeThrottled
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
    if (!shouldParseIp(playfab, ping)) {
      return { ip: PLAYFAB_TO_IP_CACHE[playfab], playfab, ping }
    }

    const ip = await timeProfiler('File parse', function () {
      return NetworkUtils.getPlayfabsIp(playfab)
    })

    PLAYFAB_TO_IP_CACHE[playfab] = ip
    return { ip, playfab, ping }
  })

  return Promise.all(promises)
}

const queue = new Queue()
const ipsThrottled = new Set()

// Interval that changes traffic rule for single item in queue
setInterval(async function () {
  if (queue.size() <= 0) {
    return
  }

  const trafficRuleInfo = queue.dequeue()

  if (trafficRuleInfo.delay > 0) {
    await NetworkUtils.addOrChangeRule(trafficRuleInfo.ip, trafficRuleInfo.delay)
  } else if (ipsThrottled.has(trafficRuleInfo.ip)) {
    await NetworkUtils.deleteRule(playerInfo.ip)
    ipsThrottled.delete(trafficRuleInfo.ip)
  }

  console.log({ trafficRuleInfoUpdated: trafficRuleInfo, newQueue: queue.queue })
}, 5000)

/**
 * Creates/deletes traffic rules depending on logic for each player
 * @param {rcon} - rcon object
 */
module.exports = async function (rcon) {
  const playerInfoList = await getPlayerInfoList(rcon)

  // For each ip, check if their ping is under minimum. If so, create a traffic rule
  const delayPromises = playerInfoList.map(async function (playerInfo) {
    const currentDelay = PLAYFAB_TO_LAST_DELAY_CACHE[playerInfo.playfab] ?? 0
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

    PLAYFAB_TO_LAST_DELAY_CACHE[playerInfo.playfab] = newDelay

    // Add the info for traffic rule change to the queue
    const trafficRuleInfo = { ip: playerInfo.ip, delay: newDelay }

    console.log({ newDelay })

    if (newDelay > 0) {
      const indexOfItemInQueue = queue.findItemIndex(function (queueItem) {
        return queueItem.ip === playerInfo.ip
      })

      console.log({ indexOfItemInQueue, trafficRuleInfo, queue: queue.queue })

      if (indexOfItemInQueue === -1) {
        console.log('ENQUEUEING', { trafficRuleInfo, queue: queue.queue })
        queue.enqueue(trafficRuleInfo)
      } else {
        console.log('UPDATING', { trafficRuleInfo, queue: queue.queue })
        queue.updateIndex(indexOfItemInQueue, trafficRuleInfo)
      }
    }
  })

  return Promise.all(delayPromises)
}
