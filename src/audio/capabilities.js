/**
 * @private
 * @function
 * @name SoundManager.hasAudio
 * @description Reports whether this device supports the HTML5 Audio tag API.
 * @returns {boolean} True if HTML5 Audio tag API is supported and false otherwise.
 */
function hasAudio() {
    return (typeof Audio !== 'undefined');
}

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

export { hasAudio, hasAudioContext };
