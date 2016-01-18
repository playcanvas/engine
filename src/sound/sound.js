pc.extend(pc, function () {
    'use strict';

    /**
    * @name pc.Sound
    * @class Represents the resource of an audio asset.
    * @property {AudioBuffer} buffer If the Web Audio API is supported this contains the audio data
    * @property {Audio} audio If the Web Audio API is not supported this contains the audio data
    * @property {Number} duration Returns the duration of the sound. If the sound is not loaded it returns 0.
    */
    var Sound = function (resource) {
        if (resource instanceof Audio) {
            this.audio = resource;
        } else {
            this.buffer = resource;
        }
    };

    Object.defineProperty(Sound.prototype, 'duration', {
        get: function () {
            var duration = 0;
            if (this.buffer) {
                duration = this.buffer.duration;
            } else if (this.audio) {
                duration = this.audio.duration;
            }

            return duration || 0;
        }
    });

    return {
        Sound: Sound
    };
}());
