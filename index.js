const MIN_PING = 100

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
const { promisifiedExec } = require('./utils/execPromise.js')
const NetworkUtils = require('./utils/network.js')

let cached_rcon = null

/**
 * Create a function that connects to rcon and returns the rcon object - call this getRcon()
 */
const getRcon = async function () {
    if (!cached_rcon){
      cached_rcon = await Rcon.connect({
        host: "192.187.124.138", port: 45851, password: "mfcstatrconfighter"
      })
    }
    return cached_rcon
}

/**
 * Create a function that gets the playerlist from the rcon object. Return the playerlist
 * This function should take an rcon object as an argument
 */
const getPlayerList = async function (rcon) {
    return rcon.send("playerlist")
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
    const pingAsNum = Number.parseInt(ping.trim().split(' ')[0])
    dictionary[playfab] = pingAsNum
  })

  return dictionary
}

const cached_playfabToIpAndDelay = {
  // '121521asrtf231': {
  //   ip: '1.2.3.4',
  //   lastAmountOfDelayAdded: 25
  // }
}

/**
 * Main execution
 */
const main = async function () {
  const rcon = await getRcon()
  const playerList = await getPlayerList(rcon)

  const pingDictionary = createPingDictionary(playerList)

  const playfabs = Object.keys(pingDictionary)
  
  const ipPromises = playfabs
    .map(async function (playfab) {
      if (cached_playfabToIpAndDelay[playfab]?.ip) {
        return { ip: cached_playfabToIpAndDelay[playfab].ip, ping: pingDictionary[playfab] }
      }

      const now = Date.now()
      const ipWithUnwantedCharacters = await promisifiedExec(`grep ${playfab} Mordhau.log | grep -oE '[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}' | tail -1`)
      const after = Date.now()
      console.log(`File parse took approximately ${after - now}ms`)

      const ip = ipWithUnwantedCharacters.replace('\n', '')
      cached_playfabToIpAndDelay[playfab] = { ip, playfab, ping: pingDictionary[playfab] }
      
      return cached_playfabToIpAndDelay[playfab]
    })
  
  const playerInfoList = await Promise.all(ipPromises)

  // For each ip, check if their ping is under minimum. If so, create a traffic rule
  const delayPromises = playerInfoList.map(async function (playerInfo) {
    const truePing = playerInfo.ping - (cached_playfabToIpAndDelay[playerInfo.playfab]?.lastAmountOfDelayAdded ?? 0)
    const amountOfDelayToAdd = Math.max(MIN_PING - truePing, 0)

    console.log({ truePing, amountOfDelayToAdd, playerInfo, cached_playerInfo: cached_playfabToIpAndDelay[playerInfo] })
    cached_playfabToIpAndDelay[playerInfo.playfab] = { ip: playerInfo.ip, lastAmountOfDelayAdded: amountOfDelayToAdd }

    if (amountOfDelayToAdd === 0) {
      await NetworkUtils.deleteRule(playerInfo.ip)
    } else {
      await NetworkUtils.addRule(playerInfo.ip, amountOfDelayToAdd)
    }
  })

  await Promise.all(delayPromises)
  console.log('All required players have been throttled')
}

setInterval(function () {
  const now = Date.now()
  main()
    .then(function () {
      const after = Date.now()
      console.log(`Main took approximately ${after - now}ms`)
      console.log({ cached_playfabToIpAndDelay })
    })
    .catch(function (err) {
      console.log('There was an error in main')
      console.log(err)
    })
}, 5000)



// more stuff

console.log('hello!')

