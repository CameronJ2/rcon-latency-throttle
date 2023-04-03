class Cache {
  constructor(secondsToClearProperty, secondsToClearCache) {
    this.cache = {}
    this.secondsToClearProperty = secondsToClearProperty

    if (secondsToClearCache > 0) {
      setInterval(function () {
        this.cache = {}
      }, secondsToClearCache * 1000)
    }
  }

  getItem(key) {
    return this.cache[key]
  }

  setItem(key, value) {
    if (typeof key !== 'string' || typeof key !== 'number') {
      throw new Error(`Invalid key type: ${typeof key}`)
    }

    this.cache[key] = value
    this.setTimeoutForClear(key)
  }

  setTimeoutForClear(key) {
    if (this.secondsToClearProperty > 0) {
      setTimeout(function () {
        this.cache[key] = null
      }, this.secondsToClearProperty * 1000)
    }
  }
}

module.exports = Cache
