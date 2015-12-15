pc.extend(pc, function () {
    'use strict';

    var Sound;

    // checks if user is running IE
    var ie = function () {
        var ua = window.navigator.userAgent;

        var msie = ua.indexOf('MSIE ');
        if (msie > 0) {
            // IE 10 or older => return version number
            return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
        }

        var trident = ua.indexOf('Trident/');
        if (trident > 0) {
            // IE 11 => return version number
            var rv = ua.indexOf('rv:');
            return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
        }

        return false;
    };

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
            try {
                this.audio = new Audio();
            } catch (e) {
                // Some windows platforms will report Audio as available, then throw an exception when
                // the object is created.
                console.warn(pc.string.format("No support for Audio element"));
                success(this);
                return;
            }


            if (!pc.AudioManager.isSupported(url, this.audio)) {
                console.warn(pc.string.format('Audio format for {0} not supported', url));
                success(this);
            } else {
                var isIE = ie();
                // audio needs to be added to the DOM for IE
                if (isIE)
                    document.body.appendChild(this.audio);

                this.audio.oncanplaythrough = function () {
                    // remove from DOM no longer necessary
                    if (isIE)
                        document.body.removeChild(this.audio);

                    if (!this.isLoaded) {
                        this.isLoaded = true;
                        success(this);
                    }
                }.bind(this);

                this.audio.onerror = function () {
                    // remove from DOM no longer necessary
                    if (isIE)
                        document.body.removeChild(this.audio);

                    // continue loading through error
                    success(this);
                };
                this.audio.src = url;
            }
        };
    }

    return {
        Sound: Sound
    };
}());
