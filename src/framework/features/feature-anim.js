import { DebugHelper } from '../../core/debug.js';
import { Feature } from '../../scene/features/feature.js';
import { AnimComponentSystem } from '../components/anim/system.js';
import { AnimClipHandler } from '../handlers/anim-clip.js';
import { AnimStateGraphHandler } from '../handlers/anim-state-graph.js';
import { AnimationHandler } from '../handlers/animation.js';
import { glbAnimations } from '../parsers/glb/animations.js';
import { registerGlbResourceExtension } from '../parsers/glb-resource-extension.js';
import { FEATURE_ANIM } from './constants.js';

/**
 * @import { AppBase } from '../app-base.js'
 */

/**
 * Animation with the {@link AnimComponent}: the {@link AnimComponentSystem}, the loading of
 * `animation`, `animclip` and `animstategraph` assets, and the animations of glTF files, in
 * {@link ContainerResource#animations}. Add it to {@link AppOptions#features} to use anim
 * components. Without it, glTF files load without their animations.
 *
 * @type {Feature}
 * @category Animation
 * @example
 * const options = new AppOptions();
 * options.features = [featureAnim];
 */
export const featureAnim = /* #__PURE__ */ new Feature({
    componentSystems: [AnimComponentSystem],
    install: (host) => {
        const app = /** @type {AppBase} */ (host);
        app.loader.addHandler('animclip', new AnimClipHandler(app));
        app.loader.addHandler('animstategraph', new AnimStateGraphHandler(app));
        app.loader.addHandler('animation', new AnimationHandler(app));
        registerGlbResourceExtension(app.loader, glbAnimations);
    }
});
DebugHelper.setName(featureAnim, FEATURE_ANIM);
