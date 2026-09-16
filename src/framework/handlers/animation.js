import { GlbAnimationParser } from '../parsers/glb-animation.js';
import { JsonAnimationParser } from '../parsers/json-animation.js';
import { ResourceHandler } from './handler.js';

/**
 * @import { AppBase } from '../app-base.js'
 */

/**
 * Resource handler for the `animation` asset type. Loads an {@link AnimTrack} from a GLB file, or
 * a legacy {@link Animation} from a PlayCanvas JSON animation file.
 *
 * @category Asset
 */
class AnimationHandler extends ResourceHandler {
    /**
     * @param {AppBase} app - The running {@link AppBase}.
     * @ignore
     */
    constructor(app) {
        super(app, 'animation');

        // read by GlbAnimationParser via this.handler
        this.device = app.graphicsDevice;
        this.assets = app.assets;

        // JSON is the catch-all (non-glb) animation format; glb is registered last so it wins for .glb
        this.addParser(new JsonAnimationParser());
        this.addParser(new GlbAnimationParser());
    }
}

export { AnimationHandler };
