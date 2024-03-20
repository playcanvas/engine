/**
 * Represents the resource of an audio asset.
 *
 * @category Sound
 */
class Sound {
    /**
     * If the Web Audio API is not supported this contains the audio data.
     *
     * @type {HTMLAudioElement|undefined}
     */
    audio;

     /**
      * If the Web Audio API is supported this contains the audio data.
      *
      * @type {AudioBuffer|undefined}
      */
    buffer;

    /**
     * Create a new Sound instance.
     *
     * @param {HTMLAudioElement|AudioBuffer} resource - If the Web Audio API is supported, pass an
     * AudioBuffer object, otherwise an Audio object.
     */
    constructor(resource) {
        if (resource instanceof Audio) {
            this.audio = resource;
        } else {
            this.buffer = resource;
        }
    }

    /**
     * Gets the duration of the sound. If the sound is not loaded it returns 0.
     *
     * @type {number}
     */
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
