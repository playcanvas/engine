/**
 * @class
 * @name Sound
 * @classdesc Represents the resource of an audio asset.
 * @param {HTMLAudioElement|AudioBuffer} resource - If the Web Audio API is supported, pass an AudioBuffer object, otherwise
 * an Audio object.
 * @property {AudioBuffer} buffer If the Web Audio API is supported this contains the audio data.
 * @property {HTMLAudioElement} audio If the Web Audio API is not supported this contains the audio data.
 * @property {number} duration Returns the duration of the sound. If the sound is not loaded it returns 0.
 */
class Sound {
    constructor(resource) {
        if (resource instanceof Audio) {
            this.audio = resource;
        } else {
            this.buffer = resource;
        }
    }

    get duration() {
        let duration = 0;
        if (this.buffer) {
            duration = this.buffer.duration;
        } else if (this.audio) {
            duration = this.audio.duration;
        }

        return duration || 0;
    }
}

export { Sound };
