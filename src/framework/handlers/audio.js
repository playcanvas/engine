import { path } from '../../core/path.js';
import { Debug } from '../../core/debug.js';

import { http, Http } from '../../platform/net/http.js';

import { hasAudioContext } from '../../platform/audio/capabilities.js';

import { Sound } from '../../platform/sound/sound.js';

import { ResourceHandler } from './handler.js';

// checks if user is running IE
const ie = (function () {
    if (typeof window === 'undefined') {
        // Node.js => return false
        return false;
    }
    const ua = window.navigator.userAgent;

    const msie = ua.indexOf('MSIE ');
    if (msie > 0) {
        // IE 10 or older => return version number
        return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
    }

    const trident = ua.indexOf('Trident/');
    if (trident > 0) {
        // IE 11 => return version number
        const rv = ua.indexOf('rv:');
        return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
    }

    return false;
})();

const supportedExtensions = [
    '.ogg',
    '.mp3',
    '.wav',
    '.mp4a',
    '.m4a',
    '.mp4',
    '.aac',
    '.opus'
];

/**
 * Resource handler used for loading {@link Sound} resources.
 *
 * @category Sound
 */
class AudioHandler extends ResourceHandler {
    /**
     * Create a new AudioHandler instance.
     *
     * @param {import('../app-base.js').AppBase} app - The running {@link AppBase}.
     * @ignore
     */
    constructor(app) {
        super(app, 'audio');

        this.manager = app.soundManager;
        Debug.assert(this.manager, "AudioHandler cannot be created without sound manager");
    }

    _isSupported(url) {
        const ext = path.getExtension(url);

        return supportedExtensions.indexOf(ext) > -1;
    }

    load(url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        const success = function (resource) {
            callback(null, new Sound(resource));
        };

        const error = function (err) {
            let msg = 'Error loading audio url: ' + url.original;
            if (err) {
                msg += ': ' + (err.message || err);
            }
            console.warn(msg);
            callback(msg);
        };

        if (this._createSound) {
            if (!this._isSupported(url.original)) {
                error(`Audio format for ${url.original} not supported`);
                return;
            }

            this._createSound(url.load, success, error);
        } else {
            error(null);
        }
    }

    /**
     * Loads an audio asset using an AudioContext by URL and calls success or error with the
     * created resource or error respectively.
     *
     * @param {string} url - The url of the audio asset.
     * @param {Function} success - Function to be called if the audio asset was loaded or if we
     * just want to continue without errors even if the audio is not loaded.
     * @param {Function} error - Function to be called if there was an error while loading the
     * audio asset.
     * @private
     */
    _createSound(url, success, error) {
        if (hasAudioContext()) {
            const manager = this.manager;

            if (!manager.context) {
                error('Audio manager has no audio context');
                return;
            }

            // if this is a blob URL we need to set the response type to arraybuffer
            const options = {
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
            let audio = null;

            try {
                audio = new Audio();
            } catch (e) {
                // Some windows platforms will report Audio as available, then throw an exception when
                // the object is created.
                error('No support for Audio element');
                return;
            }

            // audio needs to be added to the DOM for IE
            if (ie) {
                document.body.appendChild(audio);
            }

            const onReady = function () {
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
