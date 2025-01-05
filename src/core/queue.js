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
     * @param {*} value - The value to enqueue.
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
     * @returns {*} The value at the front of the queue after dequeuing,
     * or undefined if the queue is empty.
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
     * @returns {*} The value at the front of the queue without dequeuing it.
     */
    peek() {
        if (this.isEmpty()) {
            return undefined;
        }

        return this._storage[this._head];
    }

    /**
     * @returns {number} The current number of elements in the queue.
     */
    size() {
        return this._size;
    }

    /**
     * @returns {boolean} True if the queue is empty, false otherwise.
     */
    isEmpty() {
        return this._size === 0;
    }

    /**
     * Internal method to resize the underlying storage.
     * @param {number} size - The new capacity for the queue.
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
