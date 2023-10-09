const getRcon = require('../../../utils/getRcon')
const timeProfiler = require('../utils/timeProfiler')
const { getTrafficRuleUpdates } = require('../utils/getTrafficRuleUpdates')
const { queue: trafficRuleQueue } = require('./trafficRule')

const main = async function () {
  // Main takes care of adding/updating items in the queue
  const rcon = await getRcon()

  await timeProfiler('Rule adding/deleting', async function () {
    const trafficRuleUpdates = await getTrafficRuleUpdates(rcon)

    // Iterate through trafficRuleUpdates and add or update the queue
    trafficRuleUpdates.forEach(async function (trafficRuleUpdate) {
      const indexOfItemInQueue = trafficRuleQueue.findItemIndex(function (queueItem) {
        return queueItem.ip === trafficRuleUpdate.ip
      })

      if (indexOfItemInQueue === -1) {
        trafficRuleQueue.enqueue(trafficRuleUpdate)
      } else {
        trafficRuleQueue.updateIndex(indexOfItemInQueue, trafficRuleUpdate)
      }
    })
  })
}

const start = async function (POLL_RATE = 10000) {
  if (global.hasProgramTerminated) {
    return
  }

  try {
    await timeProfiler('Main', main)
  } catch (err) {
    console.log('There was an error in main')
    console.log(err)
  } finally {
    setTimeout(() => start(POLL_RATE), POLL_RATE)
  }
}

module.exports = { start }
