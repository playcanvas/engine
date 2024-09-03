/**
 * @name createDelayedExecutionRunner - magnopus patched
 * @description Delayed Execution Runner - spread out calls to a function across a batch of entities across several frames
 * @param {fn} [fn] - The callback function
 * @param {options} [opts] - Including queueSize
 * @returns {{add: Function, remove: Function, tick: Function, getTotalSize: Function}} Functions tasks add, remove, tick, getTotalSize
 */
export const createDelayedExecutionRunner = (fn, opts) => {
    const defaultOpts = {
        queueSize: 4
    };

    const options = { ...defaultOpts, ...opts };
    // ensure queue size cannot be less than 1
    options.queueSize = Math.max(1, options.queueSize);
    // the queue to execute next
    let queueTickIndex = 0;
    const queue = [];

    for (let i = 0; i < options.queueSize; i++) {
        queue[i] = new Set();
    }

    const getTotalSize = () => {
        let size = 0;
        for (const q of queue) {
            size += q.size;
        }
        return size;
    };
    const add = (entry) => {
        let smallestQueue = queue[0];
        for (const q of queue) {
            if (q.has(entry)) return;
            if (q.size < smallestQueue.size) {
                smallestQueue = q;
            }
        }
        smallestQueue.add(entry);
    };

    const remove = (entry) => {
        for (const q of queue) {
            q.delete(entry);
        }
    };

    // fire the callback function for every entry on the current queue
    const tick = (dt) => {
        const q = queue[queueTickIndex++];
        if (queueTickIndex >= queue.length) {
            queueTickIndex = 0;
        }
        q.forEach(entry => fn(entry, dt));
    };

    return {
        add,
        remove,
        tick: (dt) => {
            if (getTotalSize() > 0) tick(dt);
        },
        getTotalSize
    };
};
