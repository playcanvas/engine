import { path } from '../core/path.js';

import { http, Http } from '../net/http.js';

import { hasAudioContext } from '../audio/capabilities.js';

import { Sound } from '../sound/sound.js';

// checks if user is running IE
var ie = (function () {
    if (typeof window === 'undefined') {
        // Node.js => return false
        return false;
    }
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

const toMIME = {
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/x-wav',
    '.mp4a': 'audio/mp4',
    '.m4a': 'audio/mp4',
    '.mp4': 'audio/mp4',
    '.aac': 'audio/aac'
};

/**
 * @class
 * @name AudioHandler
 * @implements {ResourceHandler}
 * @classdesc Resource handler used for loading {@link Sound} resources.
 * @param {SoundManager} manager - The sound manager.
 */
class AudioHandler {
    constructor(manager) {
        this.manager = manager;
        this.maxRetries = 0;
    }

    _isSupported(url) {
        var ext = path.getExtension(url);

        if (toMIME[ext]) {
            return true;
        }
        return false;
    }

    load(url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        var success = function (resource) {
            callback(null, new Sound(resource));
        };

        var error = function (err) {
            var msg = 'Error loading audio url: ' + url.original;
            if (err) {
                msg += ': ' + (err.message || err);
            }
            console.warn(msg);
            callback(msg);
        };

        if (this._createSound) {
            if (!this._isSupported(url.original)) {
                error("Audio format for " + url.original + " not supported");
                return;
            }

            this._createSound(url.load, success, error);
        } else {
            error(null);
        }
    }

    open(url, data) {
        return data;
    }

    /**
     * @private
     * @function
     * @name SoundHandler._createSound
     * @description Loads an audio asset using an AudioContext by URL and calls success or error with the created resource or error respectively.
     * @param {string} url - The url of the audio asset.
     * @param {Function} success - Function to be called if the audio asset was loaded or if we
     * just want to continue without errors even if the audio is not loaded.
     * @param {Function} error - Function to be called if there was an error while loading the audio asset.
     */
    _createSound(url, success, error) {
        if (hasAudioContext()) {
            var manager = this.manager;

            if (!manager.context) {
                error('Audio manager has no audio context');
                return;
            }

            // if this is a blob URL we need to set the response type to arraybuffer
            var options = {
                retry: this.maxRetries > 0,
                maxRetries: this.maxRetries
            };

            if (url.startsWith('blob:') || url.startsWith('data:')) {
                options.responseType = Http.ResponseType.ARRAY_BUFFER;
            }

            http.get(url, options, function (err, response) {
                if (err) {
                    error(err);
                    return;
                }

                manager.context.decodeAudioData(response, success, error);
            });
        } else {
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
        }
    }
}

export { AudioHandler };
