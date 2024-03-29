const getRcon = require('../../../utils/getRcon')
const timeProfiler = require('../utils/timeProfiler')
const { getTrafficRuleUpdates } = require('../utils/getTrafficRuleUpdates')
const { queue: trafficRuleQueue } = require('./trafficRule')

let cachedRcon = null

const main = async function () {
  if (!cachedRcon || !cachedRcon?.authenticated || cachedRcon?.socket?.closed) {
    logInfo('Throttler Module - RCON not connected, attempting reconnect...')
    cachedRcon?.socket?.removeAllListeners()?.catch(logError)
    cachedRcon?.socket?.destroy()?.catch(logError)
    cachedRcon = await getRcon()
    return main()
  }

  // Main takes care of adding/updating items in the queue

  await timeProfiler('Rule adding/deleting', async function () {
    const trafficRuleUpdates = await getTrafficRuleUpdates(cachedRcon)

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
    logInfo('There was an error in main')
    logInfo(err)
  } finally {
    setTimeout(() => start(POLL_RATE), POLL_RATE)
  }
}

module.exports = { start }
