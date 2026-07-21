import { AnimStateGraphParser } from '../parsers/anim-state-graph.js';
import { ResourceHandler } from './handler.js';

/**
 * Resource handler used for loading {@link AnimStateGraph} resources.
 *
 * @ignore
 */
class AnimStateGraphHandler extends ResourceHandler {
    constructor(app) {
        super(app, 'animstategraph');

        this.addParser(new AnimStateGraphParser());
    }
}

export { AnimStateGraphHandler };
