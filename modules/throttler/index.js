const NetworkUtils = require('./utils/network.js')
const mainInterval = require('./intervals/main')
const trafficRuleInterval = require('./intervals/trafficRule')

global.hasProgramTerminated = false

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

  console.log('IN STARTUP PROCESSES', { hasProgramTerminated: global.hasProgramTerminated })
  global.hasProgramTerminated = false
  console.log('IN STARTUP PROCESSES', { hasProgramTerminated: global.hasProgramTerminated })
  mainInterval.start(process.env.POLL_RATE)
  trafficRuleInterval.start(process.env.TRAFFIC_RULE_UPDATE_RATE)

  console.log('hello!')
  const testLog = await NetworkUtils.getAllPlayfabIps()
  console.log('getAllPlayfabIps:', testLog)
}

const teardownProcesses = async function () {
  global.hasProgramTerminated = true
  await deleteAllRulesWithLogging()
}

process.on('SIGINT', async () => {
  console.log('Caught SIGINT. Performing cleanup before exiting.')
  await teardownProcesses()
  process.exit()
})

module.exports = { startupProcesses, teardownProcesses }
