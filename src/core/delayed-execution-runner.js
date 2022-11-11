/**
 * Delayed Execution Runner - spread out calls to a function across a batch of entities across several frames
 * @param fn - callback
 * @param opts - options
 * @returns
 */
export const createDelayedExecutionRunner = (fn, opts) => {
    const defaultOpts = {
        queueSize: 4,
    };
    const options = { ...defaultOpts, ...opts };
    let queueEntryIndex = 0;
    let queueTickIndex = 0;
    const queue = [];
    const getTotalSize = () => {
        let size = 0;
        for (const q of queue) {
            size += q.length;
        }
        return size;
    };
    const add = (entry) => {
        if (!Array.isArray(queue[queueEntryIndex])) {
            queue[queueEntryIndex] = [];
        }
        queue[queueEntryIndex++].push(entry);
        if (queueEntryIndex >= options.queueSize) {
            queueEntryIndex = 0;
        }
    };

  // fire the callback function for every entry on the curent queue
    const tick = (data) => {
        const q = queue[queueTickIndex++];
        if (q.length === 0) {
            tick();
            return;
        }
        if (queueTickIndex >= queue.length) {
            queueTickIndex = 0;
        }
        q.forEach((entry) => fn(entry, data));
    };

    return {
        add,
        tick,
        getTotalSize
    };
};
