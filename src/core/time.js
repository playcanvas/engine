/**
 * Get current time in milliseconds. Use it to measure time difference. Reference time may differ
 * on different platforms.
 *
 * @returns {number} The time in milliseconds.
 * @ignore
 */
const now = (typeof window !== 'undefined') && window.performance && window.performance.now && window.performance.timing ?
    performance.now.bind(performance) :
    Date.now;

export { now };
