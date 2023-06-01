const networkInterfaceId = await promisifiedExec(
    `containerId=$(docker ps --format "{{.ID}} | {{.Names}}" | grep ${process.env.CONTAINER_NAME} | awk '{ print $1 }') && interfaceId=$(docker exec -i "$containerId" cat /sys/class/net/eth0/iflink | sed 's/\\r$//') && ip ad | grep $interfaceId | awk '{ print $2 }' | awk -F@ '{ print $1 }' | grep veth`
  ).then(output => output.trim())


const deleteAllRules = async function () {
    const networkInterfaceId = await getNetworkInterfaceId()
    const command = `tcdel ${networkInterfaceId} --all`
    return promisifiedExec(command)
  }

deleteAllRules()