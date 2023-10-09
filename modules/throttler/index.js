const NetworkUtils = require('./utils/network.js')
const mainInterval = require('./intervals/main')
const trafficRuleInterval = require('./intervals/trafficRule')

global.hasProgramTerminated = false

const deleteAllRulesWithLogging = function () {
  return NetworkUtils.deleteAllRules().then(function () {
    logInfo('Wiped rules successfully')
  })
}

const startupProcesses = async function () {
  await deleteAllRulesWithLogging().catch(function (err) {
    logInfo('Error while wiping rules', err)
    process.exit()
  })

  global.hasProgramTerminated = false
  mainInterval.start(process.env.POLL_RATE)
  trafficRuleInterval.start(process.env.TRAFFIC_RULE_UPDATE_RATE)

  logInfo('hello!')
  const testLog = await NetworkUtils.getAllPlayfabIps()
  logInfo('getAllPlayfabIps:', testLog)
}

const teardownProcesses = async function () {
  global.hasProgramTerminated = true
  await deleteAllRulesWithLogging()
}

process.on('SIGINT', async () => {
  logInfo('Caught SIGINT. Performing cleanup before exiting.')
  await teardownProcesses()
  process.exit()
})

module.exports = { startupProcesses, teardownProcesses }
