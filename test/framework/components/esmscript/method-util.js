export const calls = [];
export const call = args => calls.push(args);
export const reset = () => (calls.length = 0);
