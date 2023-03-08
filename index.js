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

// const cached_playfabToIpAndDelay = {
//   // '121521asrtf231': {
//   //   ip: '1.2.3.4',
//   //   lastAmountOfDelayAdded: 25
//   // }
// }

const cached_playfabToIp = {}
const cached_playfabToLastDelay = {}

/**
 * Main execution
 */
const main = async function () {
  const rcon = await getRcon()
  const playerList = await getPlayerList(rcon)

  const pingDictionary = createPingDictionary(playerList)

  const playfabs = Object.entries(pingDictionary)
  
  const ipPromises = playfabs
    .map(async function ([playfab, ping]) {
      if (typeof cached_playfabToIp[playfab] === 'number') {
        return { ip: cached_playfabToIp[playfab], playfab, ping }
      }

      const now = Date.now()
      const ipWithUnwantedCharacters = await promisifiedExec(`grep ${playfab} Mordhau.log | grep -oE '[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}' | tail -1`)
      const after = Date.now()
      console.log(`File parse took approximately ${after - now}ms`)

      const ip = ipWithUnwantedCharacters.replace('\n', '')
      cached_playfabToIp[playfab] = ip
    
      return { ip, playfab, ping }
    })
  
  const playerInfoList = await Promise.all(ipPromises)

  // For each ip, check if their ping is under minimum. If so, create a traffic rule
  const delayPromises = playerInfoList.map(async function (playerInfo) {
    const truePing = playerInfo.ping - (cached_playfabToLastDelay[playerInfo.playfab] ?? 0)
    const amountOfDelayToAdd = Math.max(MIN_PING - truePing, 0)

    console.log({
      ip: playerInfo.ip,
      playfab: playerInfo.playfab,
      rconPing: playerInfo.ping,
      lastDelayAdded: cached_playfabToLastDelay[playerInfo.playfab],
      truePing
    })

    cached_playfabToLastDelay[playerInfo.playfab] = amountOfDelayToAdd

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
    })
    .catch(function (err) {
      console.log('There was an error in main')
      console.log(err)
    })
}, 5000)

const deleteAllRulesWithLogging = function () {
  return NetworkUtils.deleteAllRules().then(function () {
    console.log('Wiped rules successfully')
  }).catch(function (err) {
    console.log('Error while wiping rules', err)
  })
  
}

process.on("SIGINT", () => {
  console.log("Caught SIGINT. Exiting in 5 seconds.");
  deleteAllRulesWithLogging()

  setTimeout(() => {
    console.log("This should appear in the Electron console but the process will be long killed.");
    process.exit(0);
  }, 5000);
});



// more stuff

console.log('hello!')

