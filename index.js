require('dotenv').config()

const POLL_RATE = process.env.POLL_RATE ?? 6000

const getRcon = require('./utils/getRcon')
const NetworkUtils = require('./utils/network.js')
const timeProfiler = require('./utils/timeProfiler')
const updateTrafficRules = require('./utils/updateTrafficRules')

/**
 * Main execution
 */
const main = async function () {
  const rcon = await getRcon()

  await timeProfiler('Rule adding/deleting', function () {
    return updateTrafficRules(rcon)
  })

  console.log('All required players have been throttled')
}

let stopInterval = false

const mainInterval = async function () {
  if (stopInterval) {
    return
  }

  try {
    await timeProfiler('Main', main)
  } catch (err) {
    console.log('There was an error in main')
    console.log(err)
  } finally {
    setTimeout(mainInterval, POLL_RATE)
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

  mainInterval()
  console.log('hello!')
}

startupProcesses()

process.on('SIGINT', () => {
  console.log('Caught SIGINT. Performing cleanup before exiting.')
  stopInterval = true

  setTimeout(async function () {
    await deleteAllRulesWithLogging()
    process.exit()
  }, 5000)
})
