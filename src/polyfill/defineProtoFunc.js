/**
 * A short hand function to polyfill prototype methods which are not iterated in e.g. for-in loops.
 * 
 * @param {ObjectConstructor} cls 
 * @param {string} name 
 * @param {Function} func 
 * @ignore
 */
export function defineProtoFunc(cls, name, func) {
  if (!cls.prototype[name]) {
      Object.defineProperty(cls.prototype, name, {
          value: func,
          configurable: true,
          enumerable: false,
          writable: true
      });
  }
}
