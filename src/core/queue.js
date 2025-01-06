/**
 * A circular queue that automatically extends its capacity when full.
 * This implementation uses a fixed-size array to store elements and
 * supports efficient enqueue and dequeue operations.
 * It is recommended to use `initialCapacity` that is close to **real-world** usage.
 * @template T
 */
class Queue {
    /**
     * Create a new queue.
     * @param {number} [initialCapacity] - The initial capacity of the queue.
     */
    constructor(initialCapacity = 8) {
        /**
         * Underlying storage for the queue.
         * @type {Array<T|undefined>}
         * @private
         */
        this._storage = new Array(initialCapacity);

        /**
         * The head (front) index.
         * @type {number}
         * @private
         */
        this._head = 0;

        /**
         * The current number of elements in the queue.
         * @type {number}
         * @private
         */
        this._length = 0;
    }

    /**
     * The current number of elements in the queue.
     * @type {number}
     * @readonly
     */
    get length() {
        return this._length;
    }

    /**
     * Change the capacity of the underlying storage.
     * Does not shrink capacity if new capacity is less than or equal to the current length.
     * @param {number} capacity - The new capacity for the queue.
     */
    set capacity(capacity) {
        if (capacity <= this._length) {
            return;
        }

        const oldCapacity = this._storage.length;
        this._storage.length = capacity;

        // Handle wrap-around scenario by moving elements.
        if (this._head + this._length > oldCapacity) {
            const endLength = oldCapacity - this._head;
            for (let i = 0; i < endLength; i++) {
                this._storage[capacity - endLength + i] = this._storage[this._head + i];
            }
            this._head = capacity - endLength;
        }
    }

    /**
     * The capacity of the queue.
     * @type {number}
     * @readonly
     */
    get capacity() {
        return this._storage.length;
    }

    /**
     * Enqueue (push) a value to the back of the queue.
     * Automatically extends capacity if the queue is full.
     * @param {T} value - The value to enqueue.
     * @returns {number} The new length of the queue.
     */
    enqueue(value) {
        if (this._length === this._storage.length) {
            this.capacity = this._storage.length * 2;
        }

        const tailIndex = (this._head + this._length) % this._storage.length;
        this._storage[tailIndex] = value;
        this._length++;
        return this._length;
    }

    /**
     * Dequeue (pop) a value from the front of the queue.
     * @returns {T|undefined} The dequeued value, or `undefined` if the queue is empty.
     */
    dequeue() {
        if (this.isEmpty()) {
            return undefined;
        }

        const value = this._storage[this._head];
        this._storage[this._head] = undefined;
        this._head = (this._head + 1) % this._storage.length;
        this._length--;

        return value;
    }

    /**
     * Returns the value at the front of the queue without removing it.
     * @returns {T|undefined} The front value, or `undefined` if the queue is empty.
     */
    peek() {
        if (this.isEmpty()) {
            return undefined;
        }
        return this._storage[this._head];
    }

    /**
     * Determines whether the queue is empty.
     * @returns {boolean} True if the queue is empty, false otherwise.
     */
    isEmpty() {
        return this._length === 0;
    }
}

export { Queue };
