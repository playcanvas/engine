import { Debug } from '../../core/debug.js';
import { AudioParser } from '../parsers/audio.js';
import { ResourceHandler } from './handler.js';

/**
 * @import { AppBase } from '../app-base.js'
 */

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

        // read by AudioParser via this.handler
        this.manager = app.soundManager;
        Debug.assert(this.manager, 'AudioHandler cannot be created without sound manager');

        this.addParser(new AudioParser());
    }
}

export { AudioHandler };
