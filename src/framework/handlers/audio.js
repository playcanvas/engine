import { path } from '../../core/path.js';
import { Debug } from '../../core/debug.js';
import { http, Http } from '../../platform/net/http.js';
import { Sound } from '../../platform/sound/sound.js';
import { ResourceHandler } from './handler.js';

/**
 * @import { AppBase } from '../app-base.js'
 */

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
     * @param {AppBase} app - The running {@link AppBase}.
     * @ignore
     */
    constructor(app) {
        super(app, 'audio');

        this.manager = app.soundManager;
        Debug.assert(this.manager, 'AudioHandler cannot be created without sound manager');
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
            let msg = `Error loading audio url: ${url.original}`;
            if (err) {
                msg += `: ${err.message || err}`;
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

        http.get(url, options, (err, response) => {
            if (err) {
                error(err);
                return;
            }

            manager.context.decodeAudioData(response, success, error);
        });
    }
}

export { AudioHandler };
