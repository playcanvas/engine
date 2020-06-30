import { Color } from '../../../core/color.js';

import { Vec4 } from '../../../math/vec4.js';

import {
    ASPECT_AUTO,
    LAYERID_WORLD, LAYERID_DEPTH, LAYERID_SKYBOX, LAYERID_UI, LAYERID_IMMEDIATE,
    PROJECTION_PERSPECTIVE
} from '../../../scene/constants.js';

/**
 * @private
 * @class
 * @name pc.CameraComponentData
 * @augments pc.ComponentData
 * @classdesc ComponentData structure for Camera components.
 */
function CameraComponentData() {
    // serialized
    this.clearColor = new Color(0.722, 0.722, 0.722, 1);
    this.clearColorBuffer = true;
    this.clearDepthBuffer = true;
    this.clearStencilBuffer = true;
    this.nearClip = 0.1;
    this.farClip = 1000;
    this.fov = 45;
    this.orthoHeight = 100;
    this.projection = PROJECTION_PERSPECTIVE;
    this.priority = 0;
    this.rect = new Vec4(0, 0, 1, 1);
    this.scissorRect = new Vec4(0, 0, 1, 1);
    this.enabled = true;
    this.frustumCulling = false;
    this.cullFaces = true;
    this.flipFaces = false;
    this.layers = [LAYERID_WORLD, LAYERID_DEPTH, LAYERID_SKYBOX, LAYERID_UI, LAYERID_IMMEDIATE]; // default to original world, depth skybox and gizmos layers

    // not serialized
    this.camera = null;
    this.aspectRatio = 16 / 9;
    this.aspectRatioMode = ASPECT_AUTO;
    this.renderTarget = null;
    this.postEffects = null;
    this.isRendering = false;
    this.calculateTransform = null;
    this.calculateProjection = null;
}

export { CameraComponentData };
