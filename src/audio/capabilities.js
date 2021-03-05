/**
 * @private
 * @function
 * @name SoundManager.hasAudioContext
 * @description Reports whether this device supports the Web Audio API.
 * @returns {boolean} True if Web Audio is supported and false otherwise.
 */
function hasAudioContext() {
    return !!(typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined');
}

export { hasAudioContext };
