require('dotenv').config()

const NetworkUtils = require('./utils/network.js')
const timeProfiler = require('./utils/timeProfiler')
const { startMainInterval, terminate } = require('./intervals/main')
const Queue = require('./utils/Queue')

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

let hasProgramTerminated = false
const queue = new Queue()

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

  startMainInterval(process.env.POLL_RATE, queue)
  networkUpdateInterval()

  console.log('hello!')
  const testLog = await NetworkUtils.getAllPlayfabIps()
  console.log('getAllPlayfabIps:', testLog)
}

startupProcesses()

process.on('SIGINT', () => {
  console.log('Caught SIGINT. Performing cleanup before exiting.')
  terminate()
  hasProgramTerminated = false

  setTimeout(async function () {
    await deleteAllRulesWithLogging()
    process.exit()
  }, 5000)
})
