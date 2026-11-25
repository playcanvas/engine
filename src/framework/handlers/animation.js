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
 * Support for the legacy PlayCanvas JSON animation format is deprecated and will be removed in
 * Engine V3. Convert JSON animations to GLB instead. In the Editor, enable Project Settings > Asset
 * Import > Convert to GLB and reimport the animation assets.
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
