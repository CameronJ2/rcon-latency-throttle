require('dotenv').config()
const process = require('node:process')
const formatISO9075 = require('date-fns/formatISO9075')
const sub = require('date-fns/sub')
const { start: startRconChat } = require('./modules/rcon-chat')

const programStart = function () {
  startRconChat()
}

const getCurrentDateInPST = () => {
  return sub(new Date(), { hours: 7 })
}

global.logInfo = (...args) => {
  console.log(`[${formatISO9075(getCurrentDateInPST())}] `, ...args)
}

global.logError = (...args) => {
  console.error(`[${formatISO9075(getCurrentDateInPST())}] `, ...args)
}

process.on('uncaughtException', (err, origin) => {
  logInfo('UNCAUGHT EXCEPTION:', err)
})

process.on('unhandledRejection', (reason, promise) => {
  logInfo('Unhandled Rejection at:', promise, 'reason:', reason)
})

programStart()
