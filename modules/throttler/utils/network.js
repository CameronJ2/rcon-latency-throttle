/**
 * 1. Function that returns the network interface id (string)
 * 2. Function that adds a new rule
 * 3. (stretch) Function that deletes a rule
 */

const { promisifiedExec } = require('./execPromise.js')

let cached_networkInterfaceId = null

const getNetworkInterfaceId = async function () {
  if (!process.env.CONTAINER_NAME) {
    throw new Error('Must specify CONTAINER_NAME as environment variable')
  }

  if (!cached_networkInterfaceId) {
    cached_networkInterfaceId = await promisifiedExec(
      `containerId=$(docker ps --format "{{.ID}} | {{.Names}}" | grep ${process.env.CONTAINER_NAME} | awk '{ print $1 }') && interfaceId=$(docker exec -i "$containerId" cat /sys/class/net/eth0/iflink | sed 's/\\r$//') && ip ad | grep $interfaceId | awk '{ print $2 }' | awk -F@ '{ print $1 }' | grep veth`
    ).then(output => output.trim())
    console.log('GOT NETWORK ID', cached_networkInterfaceId)
  }

  return cached_networkInterfaceId
}

const getPlayfabsIp = async function (playfab) {
  const command = `grep -oE 'RemoteAddr: [0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}.*MordhauOnlineSubsystem:${playfab}' ../Mordhau.log | grep -oE '[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}' | tail -1`
  const ipWithUnwantedCharacters = await promisifiedExec(command)
  const ip = ipWithUnwantedCharacters.replace('\n', '')
  return ip
}

/**
 * Returns a dictionary of playfabs to ips
 * { AA6380B4A04CCA37: '184.98.28.14' }
 */
const getAllPlayfabIps = async function () {
  // grep -o 'RemoteAddr: [0-9\.]\+.*MordhauOnlineSubsystem:[^ ,[:space:]]*' ../Mordhau.log | sed 's/RemoteAddr: \([0-9\.]\+\).*MordhauOnlineSubsystem:\([^ ,[:space:]]*\).*/\1 \2/' | sort -u
  const command = `grep -o 'RemoteAddr: [0-9\\.]\\+.*MordhauOnlineSubsystem:[^ ,[:space:]]*' ../Mordhau.log | sed 's/RemoteAddr: \\([0-9\\.]\\+\\).*MordhauOnlineSubsystem:\\([^ ,[:space:]]*\\).*/\\1 \\2/' | tail -1`
  const ipsAndPlayfabsString = await promisifiedExec(command)
  const splitByLine = ipsAndPlayfabsString.split('\n')

  const output = {}

  splitByLine
    .filter(line => typeof line === 'string' && line.trim().length > 0)
    .forEach(function (line) {
      const [ip, playfab] = line.replace("'", '').split(' ')

      if (!output[playfab]) {
        output[playfab] = ip
      }
    })

  return output
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

module.exports = { getPlayfabsIp, getAllPlayfabIps, addOrChangeRule, deleteRule, deleteAllRules }
