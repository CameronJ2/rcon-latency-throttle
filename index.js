require('dotenv').config()

const POLL_RATE = process.env.POLL_RATE ?? 6000

const getRcon = require('./utils/getRcon')
const NetworkUtils = require('./utils/network.js')
const Queue = require('./utils/Queue')
const timeProfiler = require('./utils/timeProfiler')
const getTrafficRuleUpdates = require('./utils/getTrafficRuleUpdates')

const queue = new Queue()
/**
 * Main execution
 */
const main = async function () {
  // Main takes care of adding/updating items in the queue
  const rcon = await getRcon()

  await timeProfiler('Rule adding/deleting', async function () {
    const trafficRuleUpdates = await getTrafficRuleUpdates(rcon)

    // Iterate through trafficRuleUpdates and add or update the queue
    trafficRuleUpdates.forEach(async function (trafficRuleUpdate) {
      const indexOfItemInQueue = queue.findItemIndex(function (queueItem) {
        return queueItem.ip === trafficRuleUpdate.ip
      })

      if (indexOfItemInQueue === -1) {
        queue.enqueue(trafficRuleUpdate)
      } else {
        queue.updateIndex(indexOfItemInQueue, trafficRuleUpdate)
      }
    })
  })
}

let hasProgramTerminated = false

const mainInterval = async function () {
  if (hasProgramTerminated) {
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

const ipsThrottled = new Set()

const dequeueItemAndUpdateNetwork = async function () {
  const trafficRuleInfo = queue.dequeue()

  if (trafficRuleInfo.delay > 0) {
    await NetworkUtils.addOrChangeRule(trafficRuleInfo.ip, trafficRuleInfo.delay)
    ipsThrottled.add(trafficRuleInfo.ip)
  } else if (ipsThrottled.has(trafficRuleInfo.ip)) {
    await NetworkUtils.deleteRule(playerInfo.ip)
    ipsThrottled.delete(trafficRuleInfo.ip)
  }
}

const networkUpdateInterval = async function () {
  if (hasProgramTerminated) {
    return
  }

  try {
    if (queue.size() > 0) {
      await timeProfiler('Updating network item in queue', dequeueItemAndUpdateNetwork)
    }
  } catch (err) {
    console.log('There was an error updating a network item')
    console.log(err)
  } finally {
    setTimeout(networkUpdateInterval, 1000)
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
  networkUpdateInterval()
  console.log('hello!')
  console.log('getAllPlayfabIps:', NetworkUtils.getAllPlayfabIps())
}

startupProcesses()

process.on('SIGINT', () => {
  console.log('Caught SIGINT. Performing cleanup before exiting.')
  hasProgramTerminated = true

  setTimeout(async function () {
    await deleteAllRulesWithLogging()
    process.exit()
  }, 5000)
})
