require('dotenv').config()
const process = require('node:process')
const formatISO9075 = require('date-fns/formatISO9075')
const { start: startRconChat } = require('./modules/rcon-chat')

const programStart = function () {
  startRconChat()
}

global.logInfo = (...args) => {
  console.log(`[${formatISO9075(new Date())}] `, ...args)
}

global.logError = (...args) => {
  console.error(`[${formatISO9075(new Date())}] `, ...args)
}

process.on('uncaughtException', (err, origin) => {
  logInfo('UNCAUGHT EXCEPTION:', err)
})

process.on('unhandledRejection', (reason, promise) => {
  logInfo('Unhandled Rejection at:', promise, 'reason:', reason)
})

programStart()
