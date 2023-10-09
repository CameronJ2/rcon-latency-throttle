require('dotenv').config()
const { promisifiedExec } = require('./modules/throttler/utils/execPromise.js')

const getNetworkInterfaceId = async function () {
  const cached_networkInterfaceId = await promisifiedExec(
    `containerId=$(docker ps --format "{{.ID}} | {{.Names}}" | grep ${process.env.CONTAINER_NAME} | awk '{ print $1 }') && interfaceId=$(docker exec -i "$containerId" cat /sys/class/net/eth0/iflink | sed 's/\\r$//') && ip ad | grep $interfaceId | awk '{ print $2 }' | awk -F@ '{ print $1 }' | grep veth`
  ).then(output => output.trim())
  logInfo('GOT NETWORK ID', cached_networkInterfaceId)
  return cached_networkInterfaceId
}

const deleteAllRules = async function () {
  const networkInterfaceId = await getNetworkInterfaceId()
  const command = `tcdel ${networkInterfaceId} --all`
  return promisifiedExec(command)
}

deleteAllRules()
