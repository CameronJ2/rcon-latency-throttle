/**
 * 1. Function that returns the network interface id (string)
 * 2. Function that adds a new rule
 * 3. (stretch) Function that deletes a rule
 */

const { promisifiedExec } = require('./execPromise.js')

const cached_networkInterfaceId = null

const getNetworkInterfaceId = async function () {
  if (!cached_networkInterfaceId) {
    cached_networkInterfaceId = await promisifiedExec(`containerId=$(docker ps --format "{{.ID}} | {{.Names}}" | grep wine-dogs | awk '{ print $1 }') && interfaceId=$(docker exec -it "$containerId" cat /sys/class/net/eth0/iflink | sed 's/\\r$//') && ip ad | grep $interfaceId | awk '{ print $2 }' | awk -F@ '{ print $1 }'`)
  }

  return cached_networkInterfaceId
}

const addRule = async function (ip, amountOfDelayToAdd) {
  const networkInterfaceId = await getNetworkInterfaceId()
  return promisifiedExec(`tcset ${networkInterfaceId} --src-network ${ip}/32 --delay ${amountOfDelayToAdd}ms --change`)
}

module.exports = { addRule }