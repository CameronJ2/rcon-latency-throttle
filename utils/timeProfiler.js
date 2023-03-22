module.exports = async function (name, callback) {
  const beforeCallback = Date.now()
  const output = await callback()
  console.log(`${name} took approximately ${Date.now() - beforeCallback}ms`)
  return output
}
