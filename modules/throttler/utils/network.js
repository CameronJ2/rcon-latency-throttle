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
      `containerId=$(docker ps --format "{{.ID}} | {{.Names}}" | grep ${process.env.CONTAINER_NAME} | awk '{ print $1 }') && interfaceId=$(docker exec -i "$containerId" cat /sys/class/net/eth0/iflink | sed 's/\\r$//') && ip ad | grep -E $interfaceId\\:.veth | awk '{ print $2 }' | awk -F@ '{ print $1 }'`
    ).then(output => output.trim())

    logInfo('GOT NETWORK ID', cached_networkInterfaceId)

    setTimeout(() => {
      cached_networkInterfaceId = null
    }, 30000)
  }

  logInfo(`NETWORK INTERFACE ID:`, cached_networkInterfaceId)
  return cached_networkInterfaceId
}

/**
 * Returns a dictionary of playfabs to ips
 * { AA6380B4A04CCA37: '184.98.28.14' }
 */
const getAllPlayfabIps = async function () {
  const findLogCommand = `install_path=$(docker inspect ${process.env.CONTAINER_NAME} | grep UpperDir | awk '{print $2}' | tr -d '",'); echo $install_path/home/steam/mordhau/Mordhau/Saved/Logs/Mordhau.log`
  const logLocationWithUnwantedCharacters = await promisifiedExec(findLogCommand)
  const logLocation = logLocationWithUnwantedCharacters.replace('\n', '')

  const command = `grep -oE "RemoteAddr: [0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}.*MordhauOnlineSubsystem:.*$" ${logLocation} | tr ',:' ' ' | awk '{print $2,$17}'`
  const ipsAndPlayfabsString = await promisifiedExec(command)
  const splitByLine = ipsAndPlayfabsString.split('\n')

  const output = {}

  splitByLine
    .filter(line => typeof line === 'string' && line.trim().length > 0)
    .forEach(function (line) {
      const [ip, playfab] = line
        .replace("'", '')
        .replace(/(\r\n|\n|\r)/gm, '')
        .split(' ')

      output[playfab] = ip
    })

  logInfo(`*******FORMATTED IP LIST********`)
  logInfo(JSON.stringify(output, null, 2))
  logInfo('********************************')

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

module.exports = { getAllPlayfabIps, addOrChangeRule, deleteRule, deleteAllRules }
