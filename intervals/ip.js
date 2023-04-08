const { getAllPlayfabIps } = require('../utils/network')
const timeProfiler = require('../utils/timeProfiler')
let hasProgramTerminated = false

let playfabsToIps = {}

const start = async function (pollRate = 10000) {
  if (hasProgramTerminated) {
    return
  }

  const newPlayfabsToIps = await timeProfiler('Getting IPs', getAllPlayfabIps)
  playfabsToIps = newPlayfabsToIps

  setTimeout(start, pollRate)
}

const getPlayfabsToIps = () => playfabsToIps

const terminate = function () {}

module.exports = { start, terminate, getPlayfabsToIps }
