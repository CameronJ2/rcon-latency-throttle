const NetworkUtils = require('./utils/network.js')
const mainInterval = require('./intervals/main')
const trafficRuleInterval = require('./intervals/trafficRule')

const deleteAllRulesWithLogging = function () {
  return NetworkUtils.deleteAllRules().then(function () {
    console.log('Wiped rules successfully')
  })
}

const createInstance = function () {
  const startupProcesses = async function (minPing) {
    await deleteAllRulesWithLogging().catch(function (err) {
      console.log('Error while wiping rules', err)
      process.exit()
    })

    mainInterval.start(process.env.POLL_RATE, minPing)
    trafficRuleInterval.start(process.env.TRAFFIC_RULE_UPDATE_RATE)

    console.log('hello!')
    const testLog = await NetworkUtils.getAllPlayfabIps()
    console.log('getAllPlayfabIps:', testLog)
  }

  const teardownProcesses = function () {
    trafficRuleInterval.terminate()
    mainInterval.terminate()
  }

  return { startupProcesses, teardownProcesses }
}

process.on('SIGINT', () => {
  console.log('Caught SIGINT. Performing cleanup before exiting.')

  setTimeout(async function () {
    await deleteAllRulesWithLogging()
    process.exit()
  }, 5000)
})

module.exports = { createInstance }
