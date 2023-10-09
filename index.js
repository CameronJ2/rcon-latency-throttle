require('dotenv').config()
const process = require('node:process')
const { start: startRconChat } = require('./modules/rcon-chat')

const programStart = function () {
  startRconChat()
}

programStart()

process.on('uncaughtException', (err, origin) => {
  console.log('UNCAUGHT EXCEPTION:', err)
})

process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason)
})
