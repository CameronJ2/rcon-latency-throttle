const exec = require('child_process').exec

/**
 * Executes a shell command and return it as a Promise.
 * @param cmd {string}
 * @return {Promise<string>}
 */
module.exports.promisifiedExec = function (cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { shell: '/bin/bash' }, (error, stdout, stderr) => {
      if (error) {
        console.warn(error)
      }
      resolve(stdout ? stdout : stderr)
    })
  })
}
