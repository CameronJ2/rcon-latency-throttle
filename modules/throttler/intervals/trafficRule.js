const NetworkUtils = require('../utils/network.js')
const timeProfiler = require('../utils/timeProfiler')
const Queue = require('../utils/Queue')

const queue = new Queue()
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

const start = async function (trafficRuleUpdateRate = 1000) {
  if (global.hasProgramTerminated) {
    return
  }

  try {
    if (queue.size() > 0) {
      await timeProfiler('Updating network item in queue', dequeueItemAndUpdateNetwork)
    }
  } catch (err) {
    logInfo('There was an error updating a network item')
    logInfo(err)
  } finally {
    setTimeout(function () {
      start(trafficRuleUpdateRate)
    }, trafficRuleUpdateRate)
  }
}

module.exports = { start, queue }
