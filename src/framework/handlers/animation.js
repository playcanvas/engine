import { Debug } from '../../core/debug.js';
import { GlbAnimationParser } from '../parsers/glb-animation.js';
import { ResourceHandler } from './handler.js';

/**
 * @import { Asset } from '../asset/asset.js'
 * @import { AppBase } from '../app-base.js'
 * @import { ResourceHandlerCallback } from './handler.js'
 */

/**
 * Resource handler for the `animation` asset type. Loads an {@link AnimTrack} from a GLB file.
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

        this.addParser(new GlbAnimationParser());
    }

    /**
     * Loads an animation using the registered parser that claims it.
     *
     * @param {string | {load: string, original: string}} url - The URL of the resource to load.
     * @param {ResourceHandlerCallback} callback - The callback used when the resource is loaded or
     * an error occurs.
     * @param {Asset} [asset] - Optional asset that is passed by ResourceLoader.
     */
    load(url, callback, asset) {
        // the legacy JSON parser claimed every non-glb animation (.json, .anim, no extension), so any
        // animation no parser claims is most likely in that format
        Debug.call(() => {
            const context = this._makeContext(url, asset);
            if (!this._selectParser(context)) {
                Debug.removed(`AnimationHandler: the legacy PlayCanvas JSON animation format was removed, and ${context.url} cannot be loaded. ` +
                    'Convert your animations to GLB instead. In the Editor, enable Project Settings > Asset Import > Convert to GLB ' +
                    'and reimport the animation assets.');
            }
        });

        super.load(url, callback, asset);
    }
}

export { AnimationHandler };
