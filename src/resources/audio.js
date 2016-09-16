pc.extend(pc, function () {
    'use strict';

    // checks if user is running IE
    var ie = (function () {
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
    })();

    var AudioHandler = function (manager) {
        this.manager = manager;
    };

    AudioHandler.prototype = {
        _isSupported: function (url) {
            var toMIME = {
                '.ogg': 'audio/ogg',
                '.mp3': 'audio/mpeg',
                '.wav': 'audio/x-wav',
                '.mp4a': 'audio/mp4',
                '.m4a': 'audio/mp4',
                '.mp4': 'audio/mp4',
                '.aac': 'audio/aac'
            };

            var ext = pc.path.getExtension(url);

            if (toMIME[ext]) {
                return true;
            } else {
                return false;
            }
        },

        load: function (url, callback) {
            var success = function (resource) {
                callback(null, new pc.Sound(resource));
            };

            var error = function (msg) {
                msg = msg || 'Error loading audio url: ' + url;
                console.warn(msg);
                callback(msg);
            };

            if (this._createSound) {
                if (!this._isSupported(url)) {
                    error(pc.string.format('Audio format for {0} not supported', url));
                    return;
                }

                this._createSound(url, success, error);
            } else {
                error(null);
            }
        },

        open: function (url, data) {
            return data;
        }
    };

    if (pc.SoundManager.hasAudioContext()) {
        /**
         * @private
         * @function
         * @name  pc.SoundHandler._createSound
         * @description Loads an audio asset using an AudioContext by URL and calls success or error with the created resource or error respectively
         * @param  {String} url     The url of the audio asset
         * @param  {Function} success Function to be called if the audio asset was loaded or if we
         * just want to continue without errors even if the audio is not loaded.
         * @param  {Function} error   Function to be called if there was an error while loading the audio asset
         */
        AudioHandler.prototype._createSound = function (url, success, error) {
            var manager = this.manager;

            if (! manager.context) {
                error('Audio manager has no audio context');
                return;
            }

            pc.http.get(url, function (err, response) {
                if (err) {
                    error(err);
                    return;
                }

                manager.context.decodeAudioData(response, success, error);
            });
        };

    } else if (pc.SoundManager.hasAudio()) {
        /**
         * @private
         * @function
         * @name  pc.SoundHandler._createSound
         * @description Loads an audio asset using an Audio element by URL and calls success or error with the created resource or error respectively
         * @param  {String} url     The url of the audio asset
         * @param  {Function} success Function to be called if the audio asset was loaded or if we
         * just want to continue without errors even if the audio is not loaded.
         * @param  {Function} error   Function to be called if there was an error while loading the audio asset
         */
        AudioHandler.prototype._createSound = function (url, success, error) {
            var audio = null;

            try {
                audio = new Audio();
            } catch (e) {
                // Some windows platforms will report Audio as available, then throw an exception when
                // the object is created.
                error("No support for Audio element");
                return;
            }

            // audio needs to be added to the DOM for IE
            if (ie) {
                document.body.appendChild(audio);
            }

            var onReady = function () {
                audio.removeEventListener('canplaythrough', onReady);

                // remove from DOM no longer necessary
                if (ie) {
                    document.body.removeChild(audio);
                }

                success(audio);
            };

            audio.onerror = function () {
                audio.onerror = null;

                // remove from DOM no longer necessary
                if (ie) {
                    document.body.removeChild(audio);
                }

                error();
            };

            audio.addEventListener('canplaythrough', onReady);
            audio.src = url;
        };
    }

    return {
        AudioHandler: AudioHandler
    };
}());
