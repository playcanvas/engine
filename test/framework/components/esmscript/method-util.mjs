import { expect } from 'chai';

/**
 * Utility functions for testing methods across modules
 */

export const calls = [];
export const call = args => calls.push(args);
export const reset = () => calls.splice(0, calls.length);
export const expectCall = (index, text) => expect(calls[index]).to.equal(text);

/**
 * String generators for comparative checking
 */

export const INITIALIZE = script => `initialize ${script.constructor.name} ${script.entity.getGuid()}`;
export const POST_INITIALIZE = script => `postInitialize ${script.constructor.name} ${script.entity.getGuid()}`;
export const UPDATE = script => `update ${script.constructor.name} ${script.entity.getGuid()}`;
export const POST_UPDATE = script => `postUpdate ${script.constructor.name} ${script.entity.getGuid()}`;
export const DESTROY = script => `destroy ${script.constructor.name} ${script.entity.getGuid()}`;

// For node envs
function requestAnimationFrame(f) {
    setImmediate(() => f(Date.now()));
}

export const waitForNextFrame = () => new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
});
