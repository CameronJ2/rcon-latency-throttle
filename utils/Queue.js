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

  findItemIndex(callbackToIndicateCurrentIndexIsDesired) {
    for (let i = 0; i < this.queue; i += 1) {
      if (callbackToIndicateCurrentIndexIsDesired(this.queue[i])) {
        return i
      }
    }

    return -1
  }

  updateIndex(index, newValue) {
    if (this.queue[index] === undefined) {
      throw new Error(`Cannot update nonexisting value at ${index}`)
    }

    this.queue[index] = newValue
  }
}

module.exports = Queue
