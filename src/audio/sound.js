pc.extend(pc, function () {
    'use strict';

    var Sound = function (resource) {
        if (resource instanceof Audio) {
            this.audio = resource;
        } else {
            this.buffer = resource;
        }

        this.isLoaded = !!(this.audio || this.buffer);
    };

    return {
        Sound: Sound
    };
}());
