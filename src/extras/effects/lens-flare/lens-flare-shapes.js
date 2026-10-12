import { Debug } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR, PIXELFORMAT_RGBA8,
    SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL
} from '../../../platform/graphics/constants.js';
import { Color } from '../../../core/math/color.js';
import { RenderPass } from '../../../platform/graphics/render-pass.js';
import { RenderTarget } from '../../../platform/graphics/render-target.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { drawQuadWithShader } from '../../../scene/graphics/quad-render-utils.js';
import glslLensFlareShapePS from './glsl/shape-ps.js';
import { ShaderChunks } from '../../../scene/shader-lib/shader-chunks.js';
import { ShaderUtils } from '../../../scene/shader-lib/shader-utils.js';
import wgslLensFlareShapePS from './wgsl/shape-ps.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 */

/**
 * The description of one shape of a lens flare shape library, see {@link LensFlareShapeLibrary}:
 * a texture, with the shape in the colour channels and its coverage in alpha. A white shape on a
 * transparent background, or a grey shape on black, both work, as the sprites add the colour
 * weighted by the alpha.
 *
 * @typedef {object} LensFlareShapeDesc
 * @property {Texture|null} texture - The texture of the shape, copied into the library at the
 * resolution of the library.
 * @property {string} [name] - The name the elements reference the shape by, when the shapes of the
 * library are given as an array rather than as an object keyed by name.
 * @category Graphics
 */

/**
 * A library of lens flare shapes, copied into one texture array by a {@link LensFlareEffect}. The
 * elements of the flares reference the shapes by name, so a library is shared by every flare
 * registered with the effect, each flare using the shapes it needs.
 *
 * @typedef {object} LensFlareShapeLibrary
 * @property {number} [resolution] - The resolution the shapes are stored at, in pixels, the same
 * for all of them. Defaults to 512.
 * @property {Object<string, Texture|LensFlareShapeDesc>|LensFlareShapeDesc[]} shapes - The shapes,
 * either an object keyed by the name of each shape, with a texture or a shape description as the
 * value, or an array of named shape descriptions.
 * @category Graphics
 */

// what a layer without a texture is cleared to
const transparent = new Color(0, 0, 0, 0);

/**
 * Copies the textures of a {@link LensFlareShapeLibrary} into a texture array, one shape per
 * layer, and maps the names of the shapes to their layers.
 *
 * @ignore
 */
class LensFlareShapes {
    /**
     * @type {GraphicsDevice}
     */
    device;

    /**
     * The texture array holding the shapes, or null before the first build.
     *
     * @type {Texture|null}
     */
    texture = null;

    /**
     * The layer of each shape, by name.
     *
     * @type {Map<string, number>}
     */
    layers = new Map();

    /**
     * Incremented by each build, so that the elements referencing the layers can be rebuilt.
     *
     * @type {number}
     */
    version = 0;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        this.device = device;

        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('lensFlareShapePS', glslLensFlareShapePS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('lensFlareShapePS', wgslLensFlareShapePS);

        this._imageId = device.scope.resolve('lensFlareShapeImage');
    }

    destroy() {
        this.texture?.destroy();
        this.texture = null;
        this.layers.clear();
    }

    /**
     * Copies the shapes of a library into the texture array, recreating it when its size changes.
     *
     * @param {LensFlareShapeLibrary|null} library - The library, or null for no shapes.
     */
    build(library) {

        const shapes = this._normalize(library?.shapes);
        const resolution = math.clamp(Math.floor(library?.resolution ?? 512), 16, 4096);
        const count = Math.max(shapes.length, 1);

        const { device } = this;
        if (!this.texture || this.texture.width !== resolution || this.texture.arrayLength !== count) {
            this.texture?.destroy();
            this.texture = new Texture(device, {
                name: 'LensFlareShapes',
                width: resolution,
                height: resolution,
                arrayLength: count,
                format: PIXELFORMAT_RGBA8,
                mipmaps: true,
                minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
                magFilter: FILTER_LINEAR,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE
            });
        }

        this.layers.clear();
        for (let i = 0; i < shapes.length; i++) {
            const { name, texture } = shapes[i];
            this._copy(i, name, texture);
            this.layers.set(name, i);
        }

        this.version++;
    }

    /**
     * Turns the shapes of a library, an object keyed by name or an array of named shapes, into an
     * array of named textures, skipping invalid entries.
     *
     * @param {Object<string, Texture|object>|object[]|undefined} shapes - The shapes.
     * @returns {{ name: string, texture: Texture|null }[]} The named textures.
     * @private
     */
    _normalize(shapes) {
        const result = [];
        if (Array.isArray(shapes)) {
            for (const desc of shapes) {
                if (desc && typeof desc.name === 'string' && desc.name) {
                    result.push({ name: desc.name, texture: desc.texture ?? null });
                } else {
                    Debug.warnOnce('LensFlareEffect: a shape given in an array needs a name, skipping it.');
                }
            }
        } else if (shapes && typeof shapes === 'object') {
            for (const name in shapes) {
                const value = shapes[name];
                if (value instanceof Texture) {
                    result.push({ name, texture: value });
                } else if (value) {
                    result.push({ name, texture: value.texture ?? null });
                }
            }
        }
        return result;
    }

    /**
     * Copies one texture into a layer of the texture array.
     *
     * @param {number} layer - The layer.
     * @param {string} name - The name of the shape.
     * @param {Texture|null} texture - The texture of the shape.
     * @private
     */
    _copy(layer, name, texture) {

        if (!texture) {
            Debug.warnOnce(`LensFlareEffect: shape '${name}' has no texture, leaving it empty.`);
            this._clear(layer, name);
            return;
        }

        const { device } = this;
        this._imageId.setValue(texture);

        const shader = ShaderUtils.createShader(device, {
            uniqueName: 'LensFlareShape',
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentChunk: 'lensFlareShapePS'
        });

        // render the texture into its layer; the mipmaps of the array are regenerated afterwards
        const rt = new RenderTarget({
            name: `LensFlareShape-${name}`,
            colorBuffer: this.texture,
            layer,
            depth: false
        });
        drawQuadWithShader(device, rt, shader, undefined, undefined, 'LensFlareShapeCopy');
        rt.destroy();
    }

    /**
     * Clears a layer of the texture array, so that a layer reused from a previous library does not
     * keep its pixels when its shape has no texture.
     *
     * @param {number} layer - The layer.
     * @param {string} name - The name of the shape.
     * @private
     */
    _clear(layer, name) {
        const rt = new RenderTarget({
            name: `LensFlareShape-${name}`,
            colorBuffer: this.texture,
            layer,
            depth: false
        });
        const pass = new RenderPass(this.device);
        pass.init(rt);
        pass.setClearColor(transparent);
        pass.render();
        pass.destroy();
        rt.destroy();
    }
}

export { LensFlareShapes };
