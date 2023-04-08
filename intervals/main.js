const getRcon = require('../utils/getRcon')
const Queue = require('../utils/Queue')
const timeProfiler = require('../utils/timeProfiler')
const getTrafficRuleUpdates = require('../utils/getTrafficRuleUpdates')

const queue = new Queue()
let hasProgramTerminated = false

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

const startMainInterval = async function (POLL_RATE = 10000) {
  if (hasProgramTerminated) {
    return
  }

  try {
    await timeProfiler('Main', main)
  } catch (err) {
    console.log('There was an error in main')
    console.log(err)
  } finally {
    setTimeout(startMainInterval, POLL_RATE)
  }
}

const terminate = function () {
  hasProgramTerminated = true
}

module.exports = { startMainInterval, terminate }
