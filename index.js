require('dotenv').config()

const NetworkUtils = require('./utils/network.js')
const mainInterval = require('./intervals/main')
const trafficRuleInterval = require('./intervals/trafficRule')

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

  mainInterval.start(process.env.POLL_RATE)
  trafficRuleInterval.start(process.env.TRAFFIC_RULE_UPDATE_RATE)
  networkUpdateInterval()

  console.log('hello!')
  const testLog = await NetworkUtils.getAllPlayfabIps()
  console.log('getAllPlayfabIps:', testLog)
}

startupProcesses()

process.on('SIGINT', () => {
  console.log('Caught SIGINT. Performing cleanup before exiting.')
  trafficRuleInterval.terminate()
  mainInterval.terminate()
  hasProgramTerminated = false

  setTimeout(async function () {
    await deleteAllRulesWithLogging()
    process.exit()
  }, 5000)
})
