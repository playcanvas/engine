import { AnimClipParser } from '../parsers/anim-clip.js';
import { ResourceHandler } from './handler.js';

/**
 * @import { AppBase } from '../app-base.js'
 */

/**
 * Resource handler for the `animclip` asset type. Loads a PlayCanvas JSON animation clip into an
 * {@link AnimTrack}.
 *
 * @category Asset
 */
class AnimClipHandler extends ResourceHandler {
    /**
     * Create a new AnimClipHandler instance.
     *
     * @param {AppBase} app - The running {@link AppBase}.
     * @ignore
     */
    constructor(app) {
        super(app, 'animclip');

        this.addParser(new AnimClipParser());
    }
}

export { AnimClipHandler };
