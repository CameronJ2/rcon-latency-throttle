require('dotenv').config()
const { start: startRconChat } = require('./modules/rcon-chat')

const programStart = function () {
  startRconChat()
}
