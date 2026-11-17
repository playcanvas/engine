import { AnimStateGraphParser } from '../parsers/anim-state-graph.js';
import { ResourceHandler } from './handler.js';

/**
 * @import { AppBase } from '../app-base.js'
 */

/**
 * Resource handler for the `animstategraph` asset type. Loads a PlayCanvas JSON animation state
 * graph into an {@link AnimStateGraph}.
 *
 * @category Asset
 */
class AnimStateGraphHandler extends ResourceHandler {
    /**
     * Create a new AnimStateGraphHandler instance.
     *
     * @param {AppBase} app - The running {@link AppBase}.
     * @ignore
     */
    constructor(app) {
        super(app, 'animstategraph');

        this.addParser(new AnimStateGraphParser());
    }
}

export { AnimStateGraphHandler };
