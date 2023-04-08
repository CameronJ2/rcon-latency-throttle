const { getAllPlayfabIps } = require('../utils/network')
let hasProgramTerminated = false

let playfabsToIps = {}

const start = async function (pollRate = 20000) {
  if (hasProgramTerminated) {
    return
  }

  const newPlayfabsToIps = await getAllPlayfabIps()
  playfabsToIps = newPlayfabsToIps

  setTimeout(start, pollRate)
}

const getPlayfabsToIps = () => playfabsToIps

const terminate = function () {}

module.exports = { start, terminate, getPlayfabsToIps }
