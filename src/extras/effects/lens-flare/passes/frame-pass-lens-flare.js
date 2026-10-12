import { Color } from '../../../../core/math/color.js';
import { ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, FILTER_NEAREST, PIXELFORMAT_RGBA8 } from '../../../../platform/graphics/constants.js';
import { FramePass } from '../../../../platform/graphics/frame-pass.js';
import { RenderTarget } from '../../../../platform/graphics/render-target.js';
import { Texture } from '../../../../platform/graphics/texture.js';
import { RenderPassLensFlareOcclusion } from './render-pass-lens-flare-occlusion.js';
import { RenderPassLensFlareSprites } from './render-pass-lens-flare-sprites.js';

/**
 * @import { CameraComponent } from '../../../../framework/components/camera/component.js'
 * @import { GraphicsDevice } from '../../../../platform/graphics/graphics-device.js'
 */

/**
 * The maximum number of flares an effect draws, the size of the per-flare uniform arrays and of
 * the visibility texture.
 *
 * @type {number}
 * @ignore
 */
const LENSFLARE_MAX_FLARES = 32;

/**
 * The width of the element data texture, in texels: three texels per element, 512 elements per
 * row. Matches the constant in the sprite vertex shader.
 *
 * @type {number}
 * @ignore
 */
const LENSFLARE_ELEMENT_TEXTURE_WIDTH = 1536;

/**
 * The passes of the lens flare effect: the occlusion pass, measuring the visibility of each flare
 * source against the scene depth into a one pixel per flare texture, and the sprite pass, drawing
 * the elements of all flares into the flare texture the composition adds to the scene.
 *
 * Per-flare values are supplied every frame as two Float32Arrays of two vec4 per flare, written by
 * the effect:
 *
 * - flareData: x, y the source in normalized device coordinates, z the fade, w the scale; then
 *   r, g, b the colour.
 * - occlusionData: x, y the source, z the depth the scene is tested against, w the occlusion
 *   radius in screen heights; then x the blend factor with the previous visibility, y 1 for a
 *   source on screen, 0 for one off screen whose visibility is kept, -1 for one behind the camera.
 *
 * The elements are supplied as an RGBA32F texture of three texels per element: offset, size,
 * aspect, rotation in radians; colour and the auto rotate flag; the index of the flare and the
 * layer of the shape.
 *
 * @ignore
 */
class FramePassLensFlare extends FramePass {
    /**
     * The texture the flares are drawn to, added to the scene by the composition.
     *
     * @type {Texture}
     */
    flareTexture;

    /** @type {RenderPassLensFlareOcclusion} */
    occlusionPass;

    /** @type {RenderPassLensFlareSprites} */
    spritePass;

    /** @type {Texture[]} */
    visibilityTextures = [];

    /** @type {RenderTarget[]} */
    visibilityTargets = [];

    /** @private */
    _visibilityIndex = 0;

    /** @private */
    _flareTarget;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {CameraComponent} cameraComponent - The camera component.
     * @param {Texture} depthTexture - The scene depth, the size of the scene.
     * @param {number} format - The format of the flare texture.
     */
    constructor(device, cameraComponent, depthTexture, format) {
        super(device);

        // the visibility of the flares, measured into one and read from the other alternately
        for (let i = 0; i < 2; i++) {
            const texture = new Texture(device, {
                name: `LensFlareVisibility${i}`,
                width: LENSFLARE_MAX_FLARES,
                height: 1,
                format: PIXELFORMAT_RGBA8,
                mipmaps: false,
                minFilter: FILTER_NEAREST,
                magFilter: FILTER_NEAREST,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE
            });
            this.visibilityTextures.push(texture);
            this.visibilityTargets.push(new RenderTarget({
                name: `LensFlareVisibility${i}`,
                colorBuffer: texture,
                depth: false
            }));
        }

        this.occlusionPass = new RenderPassLensFlareOcclusion(device, cameraComponent, depthTexture);
        this.occlusionPass.init(this.visibilityTargets[0]);
        this.beforePasses.push(this.occlusionPass);

        // the flare texture, sized from the scene, at half its resolution until setScale is called
        this.flareTexture = new Texture(device, {
            name: 'LensFlareTexture',
            width: 1,
            height: 1,
            format,
            mipmaps: false,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
        this._flareTarget = new RenderTarget({
            name: 'LensFlareTexture',
            colorBuffer: this.flareTexture,
            depth: false
        });

        const scale = 0.5;
        this.spritePass = new RenderPassLensFlareSprites(device);
        this.spritePass.init(this._flareTarget, {
            resizeSource: depthTexture,
            scaleX: scale,
            scaleY: scale
        });
        this.spritePass.setClearColor(Color.BLACK);
        this.beforePasses.push(this.spritePass);
    }

    destroy() {
        this.occlusionPass.destroy();
        this.spritePass.destroy();
        this.beforePasses.length = 0;

        for (let i = 0; i < 2; i++) {
            this.visibilityTargets[i].destroyTextureBuffers();
            this.visibilityTargets[i].destroy();
        }
        this.visibilityTargets.length = 0;
        this.visibilityTextures.length = 0;

        this._flareTarget.destroyTextureBuffers();
        this._flareTarget.destroy();
        this._flareTarget = null;
        this.flareTexture = null;
    }

    /**
     * Sets the per-flare arrays the passes read every frame.
     *
     * @param {Float32Array} flareData - The flare data.
     * @param {Float32Array} occlusionData - The occlusion data.
     */
    setFlareData(flareData, occlusionData) {
        this.spritePass.flareData = flareData;
        this.occlusionPass.occlusionData = occlusionData;
    }

    /**
     * Sets the elements to draw.
     *
     * @param {Texture|null} texture - The element data texture.
     * @param {number} count - The number of elements.
     */
    setElements(texture, count) {
        this.spritePass.elementsTexture = texture;
        this.spritePass.numInstances = count;
    }

    /**
     * Sets the resolution of the flare texture, relative to the resolution of the scene.
     *
     * @param {number} scale - The scale.
     */
    setScale(scale) {
        this.spritePass.scaleX = scale;
        this.spritePass.scaleY = scale;
    }

    /**
     * Sets the baked shapes.
     *
     * @param {Texture|null} texture - The shape texture array.
     */
    setShapes(texture) {
        this.spritePass.shapesTexture = texture;
    }

    frameUpdate() {
        super.frameUpdate();

        // alternate the visibility textures: measure into one, reading the previous frame's from
        // the other, and have the sprites read the one measured this frame
        const index = 1 - this._visibilityIndex;
        this._visibilityIndex = index;
        this.occlusionPass.renderTarget = this.visibilityTargets[index];
        this.occlusionPass.previousTexture = this.visibilityTextures[1 - index];
        this.spritePass.visibilityTexture = this.visibilityTextures[index];
    }
}

export { FramePassLensFlare, LENSFLARE_MAX_FLARES, LENSFLARE_ELEMENT_TEXTURE_WIDTH };
