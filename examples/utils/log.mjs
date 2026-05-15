export const CYAN = '\x1b[36m';
export const GREEN = '\x1b[32m';
export const RED = '\x1b[31m';
export const YELLOW = '\x1b[33m';

const BOLD = '\x1b[1m';
const REGULAR = '\x1b[22m';
const RESET = '\x1b[39m';
const COLORS = process.env.FORCE_COLOR !== '0' && !process.env.NO_COLOR;

export const ms = (value) => {
    return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
};

export const bold = (value) => {
    return COLORS ? `${BOLD}${value}${REGULAR}` : value;
};

export const writeLog = (stream, code, value) => {
    const text = COLORS ? `${code}${value}${RESET}` : value;
    stream.write(`${text}\n`);
};

export const startLog = (input, output) => {
    writeLog(process.stderr, CYAN, `${bold(input)} → ${bold(output)}...`);
};

export const createdLog = (output, elapsed) => {
    writeLog(process.stderr, GREEN, `created ${bold(output)} in ${bold(ms(elapsed))}`);
};

export const failedLog = (output, elapsed) => {
    writeLog(process.stderr, RED, `failed ${bold(output)} in ${bold(ms(elapsed))}`);
};
