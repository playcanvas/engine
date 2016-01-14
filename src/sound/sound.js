pc.extend(pc, function () {
    'use strict';

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
