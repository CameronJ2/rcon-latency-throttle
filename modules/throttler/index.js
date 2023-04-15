const NetworkUtils = require('./utils/network.js')
const mainInterval = require('./intervals/main')
const trafficRuleInterval = require('./intervals/trafficRule')

global.hasProgramTerminated = false

const deleteAllRulesWithLogging = function () {
  return NetworkUtils.deleteAllRules().then(function () {
    console.log('Wiped rules successfully')
  })
}

const startupProcesses = async function (minPing) {
  await deleteAllRulesWithLogging().catch(function (err) {
    console.log('Error while wiping rules', err)
    process.exit()
  })

  global.hasProgramTerminated = false
  mainInterval.start(process.env.POLL_RATE, minPing)
  trafficRuleInterval.start(process.env.TRAFFIC_RULE_UPDATE_RATE)

  console.log('hello!')
  const testLog = await NetworkUtils.getAllPlayfabIps()
  console.log('getAllPlayfabIps:', testLog)
}

const teardownProcesses = function () {
  global.hasProgramTerminated = true

  setTimeout(async function () {
    await deleteAllRulesWithLogging()
    process.exit()
  }, 5000)
}

process.on('SIGINT', () => {
  console.log('Caught SIGINT. Performing cleanup before exiting.')
  teardownProcesses()
})

module.exports = { startupProcesses, teardownProcesses }
