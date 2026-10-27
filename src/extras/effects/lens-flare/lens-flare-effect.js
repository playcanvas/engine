import { Debug } from '../../../core/debug.js';
import { Color } from '../../../core/math/color.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { math } from '../../../core/math/math.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { Vec4 } from '../../../core/math/vec4.js';
import { now } from '../../../core/time.js';
import { ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_RGBA32F } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { PROJECTION_ORTHOGRAPHIC } from '../../../scene/constants.js';
import { Light } from '../../../scene/light.js';
import glslComposeLensFlarePS from './glsl/compose-ps.js';
import wgslComposeLensFlarePS from './wgsl/compose-ps.js';
import { CameraFrameEffect } from '../../render-passes/camera-frame-effect.js';
import { COMPOSESLOT_HDR, FRAMERESOURCE_DEPTH } from '../../render-passes/constants.js';
import { FramePassLensFlare, LENSFLARE_ELEMENT_TEXTURE_WIDTH, LENSFLARE_MAX_FLARES } from './passes/frame-pass-lens-flare.js';
import { LensFlare } from './lens-flare.js';
import { LensFlareShapes } from './lens-flare-shapes.js';

/**
 * @import { CameraFrameEffectContext, CameraFrameEffectPasses, CameraFrameEffectResources } from '../../render-passes/camera-frame-effect.js'
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 * @import { LensFlareShapeLibrary } from './lens-flare-shapes.js'
 */

const _viewProj = new Mat4();
const _clip = new Vec4();
const _position = new Vec3();
const _direction = new Vec3();
const _viewPosition = new Vec3();
const _viewDirection = new Vec3();
const _toCamera = new Vec3();
const _color = new Color();

// the depth the source of a directional light is tested at, as a fraction of the far clip - the
// sky renders at the far clip, so anything nearer occludes the sun
const directionalDepth = 0.98;

/**
 * The lens flare effect: draws the flares of the lights, or of any positions, in the scene. A
 * flare is a {@link LensFlare}, following its light, whose look places shapes along the axis from
 * the light through the centre of the screen. The shapes are textures, given to the effect as a
 * {@link LensFlareShapeLibrary} it copies into one texture array shared by all its flares. The
 * flares fade as their source is covered by the scene, measured against the scene depth, as it
 * leaves the screen, and for a spot light as the camera leaves its cone.
 *
 * The flares are drawn by passes the effect owns, at the resolution
 * {@link LensFlareEffect#scale} gives, half of the scene's by default, and added to the scene in linear HDR space, before
 * tone mapping.
 *
 * Add one to a camera frame with {@link CameraFrame#addEffect}; it is not a built-in effect.
 *
 * @example
 * const lensFlare = new LensFlareEffect(app.graphicsDevice);
 * lensFlare.shapes = {
 *     shapes: {
 *         glow: glowAsset.resource,
 *         star: starAsset.resource,
 *         disc: discAsset.resource
 *     }
 * };
 * cameraFrame.addEffect(lensFlare);
 *
 * const sun = new LensFlare({
 *     elements: [
 *         { shape: 'glow', size: 0.5, color: [1, 0.9, 0.7], intensity: 0.5 },
 *         { shape: 'star', size: 1.2, intensity: 0.4 },
 *         { shape: 'disc', offset: 0.5, size: 0.08, color: [0.4, 0.8, 1], count: 4, spread: 0.4 }
 *     ]
 * }, { light: sunEntity.light });
 * lensFlare.add(sun);
 *
 * cameraFrame.update();
 * @category Graphics
 */
class LensFlareEffect extends CameraFrameEffect {
    /**
     * The brightness of all flares. Zero disables the effect. Defaults to 1.
     *
     * @type {number}
     */
    intensity = 1;

    /**
     * The resolution the flares are drawn at, relative to the resolution of the scene, 0.25-1
     * range. Lower values are cheaper and soften the elements slightly, which suits soft shapes,
     * while 1 keeps small sharp elements crisp. Defaults to 0.5.
     *
     * @type {number}
     */
    scale = 0.5;

    /**
     * The flares registered with the effect, in the order they are drawn. Treat the array as
     * read-only; use {@link LensFlareEffect#add} and {@link LensFlareEffect#remove} to change it.
     *
     * @type {LensFlare[]}
     */
    flares = [];

    /**
     * @type {LensFlareShapeLibrary|null}
     * @private
     */
    _shapeLibrary = null;

    /** @private */
    _shapesDirty = true;

    /**
     * @type {LensFlareShapes|null}
     * @private
     */
    _shapes = null;

    /**
     * @type {Texture|null}
     * @private
     */
    _elementsTexture = null;

    /** @private */
    _elementCount = 0;

    /** @private */
    _builtKey = '';

    /**
     * @type {FramePassLensFlare|null}
     * @private
     */
    _pass = null;

    /** @private */
    _flareData = new Float32Array(LENSFLARE_MAX_FLARES * 8);

    /** @private */
    _occlusionData = new Float32Array(LENSFLARE_MAX_FLARES * 8);

    /** @private */
    _lastTime = 0;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     */
    constructor(device) {
        super(device, 'lensFlare', {
            slot: COMPOSESLOT_HDR,
            glsl: glslComposeLensFlarePS,
            wgsl: wgslComposeLensFlarePS,
            debugViews: ['lensflare'],
            requires: [FRAMERESOURCE_DEPTH]
        });
    }

    destroy() {
        super.destroy();
        this._shapes?.destroy();
        this._shapes = null;
        this._elementsTexture?.destroy();
        this._elementsTexture = null;
        this.flares.length = 0;
    }

    /**
     * Gets whether the effect contributes to the frame: when it is enabled, its intensity is
     * positive and it has flares.
     *
     * @type {boolean}
     */
    get active() {
        return this.enabled && this.intensity > 0 && this.flares.length > 0;
    }

    /**
     * Sets the shape library, see {@link LensFlareShapeLibrary}: the textures the elements of the
     * flares reference by name. Nothing is drawn until it is set. The textures are copied into
     * the effect at the next {@link CameraFrame#update}; assigning the library again copies them
     * again, so assign it after editing its shapes in place, or when a texture has loaded.
     *
     * @type {LensFlareShapeLibrary|null}
     */
    set shapes(value) {
        this._shapeLibrary = value;
        this._shapesDirty = true;
    }

    /**
     * Gets the shape library.
     *
     * @type {LensFlareShapeLibrary|null}
     */
    get shapes() {
        return this._shapeLibrary;
    }

    /**
     * Registers a flare with the effect, drawn from the next {@link CameraFrame#update}. A flare
     * can be registered with the effects of several camera frames.
     *
     * @param {LensFlare} flare - The flare.
     */
    add(flare) {
        Debug.assert(flare instanceof LensFlare, 'LensFlareEffect#add: a LensFlare is required.');
        Debug.assert(!this.flares.includes(flare), 'LensFlareEffect#add: the flare is already registered.');
        this.flares.push(flare);
    }

    /**
     * Removes a flare from the effect, from the next {@link CameraFrame#update}.
     *
     * @param {LensFlare} flare - The flare.
     */
    remove(flare) {
        const index = this.flares.indexOf(flare);
        if (index >= 0) {
            this.flares.splice(index, 1);
        }
    }

    /**
     * @param {CameraFrameEffectResources} resources - The frame resources the effect requires.
     * @param {CameraFrameEffectPasses} passes - The arrays to add the passes to, per stage.
     * @ignore
     */
    createPasses(resources, passes) {
        const cameraFrame = this.cameraFrame;
        this._pass = new FramePassLensFlare(this.device, cameraFrame.cameraComponent, resources.depth.texture,
            cameraFrame.hdrFormat);
        passes.postResolve.push(this._pass);
    }

    /**
     * @ignore
     */
    destroyPasses() {
        this._pass?.destroy();
        this._pass = null;
    }

    update() {

        // copy the shapes when the library changed
        if (this._shapesDirty) {
            this._shapes ??= new LensFlareShapes(this.device);
            this._shapes.build(this._shapeLibrary);
            this._shapesDirty = false;
        }

        Debug.call(() => {
            if (!this._shapeLibrary && this.flares.length > 0) {
                Debug.warnOnce('LensFlareEffect: no shape library is set, so the flares are not drawn. Set LensFlareEffect#shapes to the textures their elements reference.');
            }
        });

        // rebuild the elements when the shapes, the flares or their looks changed
        let key = `${this._shapes.version}`;
        const flares = this.flares;
        for (let i = 0; i < flares.length; i++) {
            key += `|${flares[i]._uid}:${flares[i]._version}`;
        }
        if (key !== this._builtKey) {
            this._rebuildElements();
            this._builtKey = key;
        }

        Debug.call(() => {
            if (flares.length > LENSFLARE_MAX_FLARES) {
                Debug.warnOnce(`LensFlareEffect: ${flares.length} flares are registered, only the first ${LENSFLARE_MAX_FLARES} are drawn.`);
            }
        });

        const pass = this._pass;
        pass.setScale(math.clamp(this.scale, 0.1, 1));
        pass.setShapes(this._shapes.texture);
        pass.setElements(this._elementsTexture, this._elementCount);
        pass.setFlareData(this._flareData, this._occlusionData);

        this.setUniform('lensFlareTexture', pass.flareTexture);
        this.setUniform('lensFlareIntensity', this.intensity);
    }

    /**
     * Builds the element data texture from the looks of the flares, resolving the shapes of the
     * elements to the layers of the baked shapes.
     *
     * @private
     */
    _rebuildElements() {

        // without a library there are no shapes to draw
        if (!this._shapeLibrary) {
            this._elementCount = 0;
            return;
        }

        const layers = this._shapes.layers;
        const flares = this.flares;
        const flareCount = Math.min(flares.length, LENSFLARE_MAX_FLARES);

        // the number of element instances, counting the copies
        let total = 0;
        for (let i = 0; i < flareCount; i++) {
            const elements = flares[i].look?.elements;
            if (elements) {
                for (let j = 0; j < elements.length; j++) {
                    total += Math.max(1, Math.floor(elements[j].count ?? 1));
                }
            }
        }

        const width = LENSFLARE_ELEMENT_TEXTURE_WIDTH;
        const height = Math.max(1, Math.ceil((total * 3) / width));
        const data = new Float32Array(width * height * 4);

        let count = 0;
        for (let i = 0; i < flareCount; i++) {
            const elements = flares[i].look?.elements;
            if (!elements) continue;

            for (let j = 0; j < elements.length; j++) {
                const element = elements[j];
                const layer = layers.get(element.shape);
                if (layer === undefined) {
                    Debug.warnOnce(`LensFlareEffect: the shape library has no shape named '${element.shape}', skipping the element.`);
                    continue;
                }

                const offset = element.offset ?? 0;
                const size = element.size ?? 0.1;
                const aspect = element.aspect ?? 1;
                const rotation = (element.rotation ?? 0) * math.DEG_TO_RAD;
                const intensity = element.intensity ?? 1;
                const color = element.color;
                const r = color ? (color.r ?? color[0] ?? 1) : 1;
                const g = color ? (color.g ?? color[1] ?? 1) : 1;
                const b = color ? (color.b ?? color[2] ?? 1) : 1;
                const autoRotate = element.autoRotate ? 1 : 0;
                const copies = Math.max(1, Math.floor(element.count ?? 1));
                const spread = element.spread ?? 0;

                for (let k = 0; k < copies; k++) {
                    const base = count * 12;
                    data[base + 0] = copies > 1 ? offset + spread * (k / (copies - 1) - 0.5) : offset;
                    data[base + 1] = size;
                    data[base + 2] = aspect;
                    data[base + 3] = rotation;
                    data[base + 4] = r * intensity;
                    data[base + 5] = g * intensity;
                    data[base + 6] = b * intensity;
                    data[base + 7] = autoRotate;
                    data[base + 8] = i;
                    data[base + 9] = layer;
                    count++;
                }
            }
        }

        // upload, recreating the texture when its size changes
        let texture = this._elementsTexture;
        if (!texture || texture.width !== width || texture.height !== height) {
            texture?.destroy();
            texture = new Texture(this.device, {
                name: 'LensFlareElements',
                width,
                height,
                format: PIXELFORMAT_RGBA32F,
                mipmaps: false,
                minFilter: FILTER_NEAREST,
                magFilter: FILTER_NEAREST,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE
            });
            this._elementsTexture = texture;
        }
        texture.lock().set(data);
        texture.unlock();

        this._elementCount = count;
    }

    /**
     * @param {CameraFrameEffectContext} frame - The values of this frame.
     */
    frameUpdate(frame) {

        // the time since the last frame, for the occlusion fade
        const time = now();
        const dt = this._lastTime > 0 ? math.clamp((time - this._lastTime) / 1000, 0, 0.1) : 0;
        this._lastTime = time;

        // the camera of the passes, as the effect can be removed from its camera frame while the
        // frame still renders them, until the camera frame updates
        const cameraComponent = this._pass.cameraComponent;
        const camera = cameraComponent.camera;
        const view = camera.viewMatrix;
        _viewProj.mul2(camera.projectionMatrix, view);
        const cameraPosition = cameraComponent.entity.getPosition();
        const far = camera.farClip;
        const orthographic = camera.projection === PROJECTION_ORTHOGRAPHIC;
        const physicalUnits = cameraComponent.system.app.scene.physicalUnits;

        const flareData = this._flareData;
        const occlusionData = this._occlusionData;
        flareData.fill(0);
        occlusionData.fill(0);

        const flares = this.flares;
        const count = Math.min(flares.length, LENSFLARE_MAX_FLARES);
        for (let i = 0; i < count; i++) {
            const flare = flares[i];
            const base = i * 8;
            let fade = flare.enabled ? 1 : 0;

            // the source: a direction for a directional light, a position otherwise
            let directional = false;
            const light = flare.light;
            if (light) {
                const entity = light.entity;
                if (!light.enabled || !entity.enabled) {
                    fade = 0;
                }

                // lights shine along the negative y axis of their entity
                if (light.type === 'directional') {
                    directional = true;
                    _direction.copy(entity.up);
                } else {
                    _position.copy(entity.getPosition());

                    // a spot light flares within its cone
                    if (light.type === 'spot') {
                        const cosOuter = Math.cos(light.outerConeAngle * math.DEG_TO_RAD);
                        const cosInner = Math.cos(light.innerConeAngle * math.DEG_TO_RAD);
                        _toCamera.sub2(cameraPosition, _position).normalize();
                        const cosAngle = -_toCamera.dot(entity.up);
                        fade *= cosInner > cosOuter ? math.smoothstep(cosOuter, cosInner, cosAngle) : (cosAngle >= cosOuter ? 1 : 0);
                    }
                }
            } else if (flare.node) {
                _position.copy(flare.node.getPosition());
            } else if (flare.direction) {
                directional = true;
                _direction.copy(flare.direction).normalize();
            } else if (flare.position) {
                _position.copy(flare.position);
            } else {
                fade = 0;
            }

            // whether the source is in front of the camera, tested in view space, as the clip space
            // w does not tell for an orthographic projection
            let inFront;
            if (directional) {
                view.transformVector(_direction, _viewDirection);
                inFront = _viewDirection.z < 0;

                // an orthographic projection has no vanishing point for a direction, so the source
                // is placed far along it instead
                if (orthographic) {
                    _position.copy(_direction).mulScalar(far * directionalDepth).add(cameraPosition);
                    _clip.set(_position.x, _position.y, _position.z, 1);
                } else {
                    _clip.set(_direction.x, _direction.y, _direction.z, 0);
                }
            } else {
                view.transformPoint(_position, _viewPosition);
                inFront = _viewPosition.z < 0;
                _clip.set(_position.x, _position.y, _position.z, 1);
            }
            _viewProj.transformVec4(_clip, _clip);

            let x = 0;
            let y = 0;
            let onScreen = -1;
            if (inFront && Math.abs(_clip.w) > 1e-6) {
                x = _clip.x / _clip.w;
                y = _clip.y / _clip.w;

                // fade out at the edge of the screen, and beyond it when allowed
                const m = Math.max(Math.abs(x), Math.abs(y));
                const edgeFade = Math.max(flare.edgeFade, 0);
                const start = 1 - edgeFade;
                const end = flare.allowOffScreen ? 1 + edgeFade : 1;
                fade *= end > start ? 1 - math.smoothstep(start, end, m) : (m <= end ? 1 : 0);
                onScreen = m <= 1 ? 1 : 0;
            } else {
                fade = 0;
            }

            // the depth the visibility is tested against, and the distance fade
            let sourceDepth = far * directionalDepth;
            if (!directional) {
                sourceDepth = -_viewPosition.z - flare.occlusionOffset;

                if (flare.fadeEnd > flare.fadeStart) {
                    fade *= 1 - math.smoothstep(flare.fadeStart, flare.fadeEnd, _position.distance(cameraPosition));
                }
            }

            // the colour, tinted by the light and scaled by its intensity
            const color = flare.color;
            let intensity = flare.intensity;
            if (light && flare.useLightIntensity) {
                if (physicalUnits) {
                    // the luminance, converted to the units the light renders with, as for the lighting
                    const outer = light.outerConeAngle * math.DEG_TO_RAD;
                    const inner = light.innerConeAngle * math.DEG_TO_RAD;
                    intensity *= light.luminance / Light.getLightUnitConversion(light.light.type, outer, inner);
                } else {
                    intensity *= light.intensity;
                }
            }
            let r = color.r * intensity;
            let g = color.g * intensity;
            let b = color.b * intensity;
            if (light && flare.useLightColor) {
                _color.linear(light.color);
                r *= _color.r;
                g *= _color.g;
                b *= _color.b;
            }

            flareData[base + 0] = x;
            flareData[base + 1] = y;
            flareData[base + 2] = fade;
            flareData[base + 3] = flare.scale;
            flareData[base + 4] = r;
            flareData[base + 5] = g;
            flareData[base + 6] = b;

            occlusionData[base + 0] = x;
            occlusionData[base + 1] = y;
            occlusionData[base + 2] = sourceDepth;
            occlusionData[base + 3] = flare.occlusionRadius;
            occlusionData[base + 4] = flare.occlusionFade > 0 ? 1 - Math.exp(-dt / flare.occlusionFade) : 1;
            occlusionData[base + 5] = onScreen;
        }
    }
}

export { LensFlareEffect };
