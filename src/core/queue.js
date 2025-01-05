
/**
 * A circular queue that automatically extends its capacity when full.
 * This implementation uses a fixed-size array to store elements and
 * supports efficient enqueue and dequeue operations.
 * It is recommended to use `initialCapacity` that is close to **real-world** usage.
 */
class Queue {
    constructor(initialCapacity = 8) {
        this._storage = new Array(initialCapacity);

        this._capacity = initialCapacity;

        this._head = 0;

        this._size = 0;
    }

    /**
     * Enqueue (push) a value to the back of the queue.
     * Automatically extends capacity if the queue is full.
     * @param {*} value The value to enqueue.
     */
    enqueue(value) {
        if (this._size === this._capacity) {
            this.resize(this._capacity * 2);
        }

        const tailIndex = (this._head + this._size) % this._capacity;
        this._storage[tailIndex] = value;
        this._size++;
    }

    /**
     * Dequeue (pop) a value from the front of the queue.
     * Returns undefined if the queue is empty.
     * @returns {*}
     */
    dequeue() {
        if (this.isEmpty()) {
            return undefined;
        }

        const value = this._storage[this._head];
        this._storage[this._head] = undefined;
        this._head = (this._head + 1) % this._capacity;
        this._size--;

        return value;
    }

    /**
     * Return the front element without removing it.
     * @returns {*}
     */
    peek() {
        if (this.isEmpty()) {
            return undefined;
        }

        return this._storage[this._head];
    }

    /**
     * The current number of elements in the queue.
     * @returns {number}
     */
    size() {
        return this._size;
    }

    /**
     * Check if the queue is empty.
     * @returns {boolean}
     */
    isEmpty() {
        return this._size === 0;
    }

    /**
     * Internal method to resize the underlying storage.
     * @param {number} size The new capacity for the queue.
     */
    resize(size) {
        if (size <= this._size) {
            return;
        }

        const newStorage = new Array(size);

        for (let i = 0; i < this._size; i++) {
            const index = (this._head + i) % this._capacity;
            newStorage[i] = this._storage[index];
        }

        this._head = 0;
        this._capacity = size;
        this._storage = newStorage;
    }
}

export { Queue };
