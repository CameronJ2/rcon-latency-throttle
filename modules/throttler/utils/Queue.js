class Queue {
  constructor() {
    this.queue = []
  }

  // Adds a value to the queue
  enqueue(value) {
    this.queue.push(value)
    return this.queue.length
  }

  dequeue() {
    const output = this.queue[0]
    this.queue = this.queue.slice(1)
    return output
  }

  size() {
    return this.queue.length
  }

  findItemIndex(callbackToIndicateCurrentIndexIsDesired) {
    return this.queue.indexOf(callbackToIndicateCurrentIndexIsDesired)
  }

  updateIndex(index, newValue) {
    if (this.queue[index] === undefined) {
      throw new Error(`Cannot update nonexisting value at ${index}`)
    }

    this.queue[index] = newValue
  }
}

module.exports = Queue
