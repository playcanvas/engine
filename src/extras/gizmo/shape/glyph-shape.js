import { CULLFACE_NONE } from '../../../platform/graphics/constants.js';
import { PlaneGeometry } from '../../../scene/geometry/plane-geometry.js';
import { Mesh } from '../../../scene/mesh.js';
import { Shape } from './shape.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 * @import { Texture } from '../../../platform/graphics/texture.js'
 * @import { ShapeArgs } from './shape.js'
 */

/**
 * A unit square in the xz plane, its texture alpha drawn in the shape color. The top of the
 * texture is at -z.
 *
 * @ignore
 */
class GlyphShape extends Shape {
    /**
     * Create a new GlyphShape.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {ShapeArgs & { texture: Texture }} args - The shape options.
     */
    constructor(device, args) {
        super(device, 'glyph', { cull: CULLFACE_NONE, ...args });

        this._createRenderComponent(this.entity, [Mesh.fromGeometry(device, new PlaneGeometry({
            widthSegments: 1,
            lengthSegments: 1
        }))]);
        for (const material of [this._material, this._occludedMaterial]) {
            material?.setDefine('TEXTURE', true);
            material?.setParameter('uTexture', args.texture);
            material?.update();
        }
    }
}

export { GlyphShape };
