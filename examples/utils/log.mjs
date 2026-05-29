export const CYAN = '\x1b[36m';
export const GREEN = '\x1b[32m';
export const RED = '\x1b[31m';
export const YELLOW = '\x1b[33m';

const BOLD = '\x1b[1m';
const REGULAR = '\x1b[22m';
const RESET = '\x1b[39m';
const COLORS = process.env.FORCE_COLOR !== '0' && !process.env.NO_COLOR;
const SECOND = 1000;
const MINUTE = 60 * SECOND;

/**
 * @param {number} value - millisecond value.
 * @returns {string} formatted duration.
 */
export const ms = (value) => {
    if (value >= MINUTE) {
        const minutes = Math.floor(value / MINUTE);
        const seconds = Math.floor((value % MINUTE) / SECOND);
        return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
    }
    if (value >= SECOND) {
        return `${Math.floor(value / 100) / 10}s`;
    }
    return `${value >= 1 ? Math.round(value) : Math.ceil(value)}ms`;
};

/**
 * @param {string | number} value - value to format.
 * @returns {string | number} bold value.
 */
export const bold = (value) => {
    return COLORS ? `${BOLD}${value}${REGULAR}` : value;
};

/**
 * @param {NodeJS.WritableStream} stream - output stream.
 * @param {string} code - color code.
 * @param {string | number} value - log value.
 * @returns {void} no return value.
 */
export const writeLog = (stream, code, value) => {
    const text = COLORS ? `${code}${value}${RESET}` : value;
    stream.write(`${text}\n`);
};

/**
 * @param {string} input - source label.
 * @param {string} output - output label.
 * @returns {void} no return value.
 */
export const startLog = (input, output) => {
    writeLog(process.stderr, CYAN, `${bold(input)} → ${bold(output)}...`);
};

/**
 * @param {string} output - output label.
 * @param {number} elapsed - elapsed milliseconds.
 * @returns {void} no return value.
 */
export const createdLog = (output, elapsed) => {
    writeLog(process.stderr, GREEN, `created ${bold(output)} in ${bold(ms(elapsed))}`);
};

/**
 * @param {string} output - output label.
 * @param {number} elapsed - elapsed milliseconds.
 * @returns {void} no return value.
 */
export const failedLog = (output, elapsed) => {
    writeLog(process.stderr, RED, `failed ${bold(output)} in ${bold(ms(elapsed))}`);
};
