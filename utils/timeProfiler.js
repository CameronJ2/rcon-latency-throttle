module.exports = async function (description, callback) {
  const beforeCallback = Date.now()
  const output = await callback()
  console.log(`${description} took approximately ${Date.now() - beforeCallback}ms`)
  return output
}
