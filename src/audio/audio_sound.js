pc.extend(pc, function () {
    'use strict';

    var Sound;

    if (pc.AudioManager.hasAudioContext()) {
        Sound = function (manager, url, success, error) {
            this.buffer = null;
            this.isLoaded = false;

            if (!pc.AudioManager.isSupported(url, this.audio)) {
                setTimeout(function () {
                    console.warn(pc.string.format('Audio format for {0} not supported', url));
                    success(this);
                }, 0);
            } else {
                if (manager.context) {
                    pc.net.http.get(url, function (response) {
                        manager.context.decodeAudioData(response, function (buffer) {
                            this.buffer = buffer;
                            this.isLoaded = true;
                            success(this);
                        }.bind(this), error);
                    }.bind(this), {
                        error: error,
                        withCredentials: false
                    });
                }
            }
        };
    } else if (pc.AudioManager.hasAudio()) {
        Sound = function (manager, url, success, error) {
            this.isLoaded = false;
            this.audio = new Audio();

            if (!pc.AudioManager.isSupported(url, this.audio)) {
                console.warn(pc.string.format('Audio format for {0} not supported', url))
                success(this);
            } else {
                this.audio.oncanplaythrough = function () {
                    if (!this.isLoaded) {
                        this.isLoaded = true;
                        success(this);
                    }
                }.bind(this);

                this.audio.onerror = function () {
                    // continue loading through error
                    success(this);
                }
                this.audio.src = url;
            }
        };
    }

    return {
        Sound: Sound
    };
}());
