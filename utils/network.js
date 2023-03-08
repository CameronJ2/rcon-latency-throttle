/**
 * 1. Function that returns the network interface id (string)
 * 2. Function that adds a new rule
 * 3. (stretch) Function that deletes a rule
 */

const { promisifiedExec } = require('./execPromise.js')

let cached_networkInterfaceId = null

const getNetworkInterfaceId = async function () {
  if (!cached_networkInterfaceId) {
    cached_networkInterfaceId = await promisifiedExec(
      `containerId=$(docker ps --format "{{.ID}} | {{.Names}}" | grep wine-dogs | awk '{ print $1 }') && interfaceId=$(docker exec -i "$containerId" cat /sys/class/net/eth0/iflink | sed 's/\\r$//') && ip ad | grep $interfaceId | awk '{ print $2 }' | awk -F@ '{ print $1 }'`
    ).then(output => output.trim())
    console.log('GOT NETWORK ID', cached_networkInterfaceId)
  }

  return cached_networkInterfaceId
}

const addOrChangeRule = async function (ip, amountOfDelayToAdd) {
  const networkInterfaceId = await getNetworkInterfaceId()
  const command = `tcset ${networkInterfaceId} --src-network ${ip}/32 --delay ${amountOfDelayToAdd}ms --change`
  return promisifiedExec(command)
}

const deleteRule = async function (ip) {
  const networkInterfaceId = await getNetworkInterfaceId()
  const command = `tcdel ${networkInterfaceId} --src-network ${ip}/32`
  return promisifiedExec(command).catch(() => {})
}

const deleteAllRules = async function () {
  const networkInterfaceId = await getNetworkInterfaceId()
  const command = `tcdel ${networkInterfaceId} --all`
  return promisifiedExec(command)
}

module.exports = { addOrChangeRule, deleteRule, deleteAllRules }
