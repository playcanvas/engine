import { Color, LensFlare, LensFlareEffect, Script, Vec2 } from 'playcanvas';
import { CameraFrameEffectScript } from './camera-frame-effect.mjs';

/**
 * @import { Asset, Entity, LensFlareShapeLibrary } from 'playcanvas';
 */

/** @enum {string} */
const ShapeResolution = {
    R128: '128',
    R256: '256',
    R512: '512',
    R1024: '1024'
};

/**
 * Resolves a {@link ShapeResolution} to a number of pixels. Numeric values are passed through
 * unchanged.
 *
 * @param {ShapeResolution|number} value - The resolution.
 * @returns {number} The resolution in pixels.
 */
const resolveResolution = (value) => {
    return typeof value === 'number' ? value : (parseInt(value, 10) || 256);
};

/**
 * One shape of the shape library of the {@link LensFlareEffectScript}: a texture, copied into a
 * layer of the texture array the flares draw from. Elements reference it by name.
 *
 * @interface
 * @category Post-Processing
 */
class LensFlareShape {
    /**
     * The name the elements of the flares reference the shape by.
     *
     * @placeholder unique name, referenced by elements
     */
    name = '';

    /**
     * The texture of the shape, with the shape in the colour channels and its coverage in alpha.
     *
     * @type {Asset}
     * @resource texture
     */
    texture = null;
}

/**
 * One element of the look of a {@link LensFlareScript}: a shape placed on the axis from the light
 * through the centre of the screen.
 *
 * @interface
 * @category Post-Processing
 */
class LensFlareElement {
    /**
     * The name of a shape of the shape library of the lens flare effect.
     *
     * @placeholder shape name from the effect's library
     */
    shape = '';

    /**
     * The position along the axis: 0 at the light, 1 at the centre of the screen, 2 mirrored
     * across it, negative beyond the light.
     *
     * @range [-1, 3]
     * @precision 2
     * @step 0.01
     */
    offset = 0;

    /**
     * The height of the element, as a fraction of the screen height.
     *
     * @range [0, 2]
     * @precision 3
     * @step 0.005
     */
    size = 0.1;

    /**
     * The width of the element relative to its height.
     *
     * @range [0.05, 40]
     * @precision 2
     * @step 0.05
     */
    aspect = 1;

    /**
     * @range [-180, 180]
     * @precision 1
     * @step 1
     */
    rotation = 0;

    /**
     * Whether the element is rotated to align with the axis, for streaks.
     */
    autoRotate = false;

    color = new Color(1, 1, 1);

    /**
     * @range [0, 10]
     * @precision 2
     * @step 0.01
     */
    intensity = 1;

    /**
     * The number of copies of the element, spread along the axis around its offset.
     *
     * @range [1, 16]
     * @precision 0
     * @step 1
     */
    count = 1;

    /**
     * The distance along the axis the copies are spread over, in the units of the offset.
     *
     * @visibleif {count > 1}
     * @range [0, 2]
     * @precision 2
     * @step 0.01
     */
    spread = 0.2;
}

/**
 * Adds the {@link LensFlareEffect} to the camera frame of the camera entity it is attached to,
 * next to the `cameraFrame` script, and holds the shape library the flares of all
 * {@link LensFlareScript | lensFlare} scripts in the scene draw from: the textures their elements
 * reference by name. Nothing is drawn until shapes are added.
 *
 * @category Post-Processing
 */
class LensFlareEffectScript extends CameraFrameEffectScript {
    static scriptName = 'lensFlareEffect';

    /**
     * The brightness of all flares.
     *
     * @attribute
     * @range [0, 5]
     * @precision 2
     * @step 0.01
     */
    intensity = 1;

    /**
     * The resolution the flares are drawn at, relative to the resolution of the scene.
     *
     * @attribute
     * @range [0.25, 1]
     * @precision 2
     * @step 0.05
     */
    scale = 0.5;

    /**
     * The resolution of each baked shape. Soft shapes are fine at 256, sharp polygons and
     * starbursts shown large benefit from 512.
     *
     * @attribute
     * @type {ShapeResolution}
     */
    resolution = ShapeResolution.R256;

    /**
     * The shapes the elements of the flares reference by name. The shapes are copied again when a
     * different array is assigned, which is what the Editor does on every edit - assign a new
     * array to change them from code.
     *
     * @attribute
     * @type {LensFlareShape[]}
     */
    shapes = [];

    /** @private */
    _bakedShapes = null;

    /** @private */
    _bakedResolution = null;

    /** @private */
    _shapesDirty = false;

    createEffect(device) {
        return new LensFlareEffect(device);
    }

    updateEffect(effect) {
        effect.intensity = this.intensity;
        effect.scale = this.scale;

        if (this._shapesDirty || this.shapes !== this._bakedShapes || this.resolution !== this._bakedResolution) {
            this._shapesDirty = false;
            this._bakedShapes = this.shapes;
            this._bakedResolution = this.resolution;
            effect.shapes = this._buildLibrary();
        }
    }

    /**
     * Builds the shape library from the shape attributes, loading the textures which are not
     * loaded yet and rebuilding once they are.
     *
     * @returns {LensFlareShapeLibrary|null} The library, or null when there are no shapes.
     * @private
     */
    _buildLibrary() {
        const shapes = this.shapes;
        if (!shapes || shapes.length === 0) {
            return null;
        }

        const library = { resolution: resolveResolution(this.resolution), shapes: [] };
        for (let i = 0; i < shapes.length; i++) {
            const shape = shapes[i];

            // the texture, loaded on demand
            let texture = null;
            const asset = shape.texture;
            if (asset) {
                if (asset.resource) {
                    texture = asset.resource;
                } else {
                    asset.once('load', () => {
                        this._shapesDirty = true;
                    });
                    this.app.assets.load(asset);
                }
            }

            library.shapes.push({
                name: shape.name || `shape${i}`,
                texture
            });
        }
        return library;
    }
}

/**
 * Gives the entity it is attached to a lens flare, drawn by the {@link LensFlareEffectScript}
 * of every camera, or of the chosen one. With a light component on the entity the flare follows
 * the light: the direction of a directional light, the position of an omni or spot light, and the
 * cone of a spot light. Without one it follows the position of the entity.
 *
 * @category Post-Processing
 */
class LensFlareScript extends Script {
    static scriptName = 'lensFlare';

    /**
     * The camera entity whose lens flare effect draws the flare. Leave unset to draw it with every
     * camera that has the effect.
     *
     * @attribute
     * @type {Entity}
     */
    camera = null;

    /**
     * The brightness of the flare.
     *
     * @attribute
     * @range [0, 10]
     * @precision 2
     * @step 0.01
     */
    intensity = 1;

    /**
     * The colour of the flare.
     *
     * @attribute
     */
    color = new Color(1, 1, 1);

    /**
     * The scale of the flare, multiplying the size of its elements.
     *
     * @attribute
     * @range [0, 4]
     * @precision 2
     * @step 0.01
     */
    scale = 1;

    /**
     * Whether the colour of the light tints the flare.
     *
     * @attribute
     */
    useLightColor = true;

    /**
     * The radius around the light the visibility is measured in, as a fraction of the screen
     * height.
     *
     * @attribute
     * @range [0, 0.2]
     * @precision 3
     * @step 0.001
     */
    occlusionRadius = 0.02;

    /**
     * The time the visibility takes to follow a change, in seconds.
     *
     * @attribute
     * @range [0, 1]
     * @precision 2
     * @step 0.01
     */
    occlusionFade = 0.15;

    /**
     * The distance the visibility test is moved towards the camera, in world units, so that the
     * geometry of the light itself does not occlude its flare.
     *
     * @attribute
     * @range [0, 10]
     * @precision 2
     * @step 0.05
     */
    occlusionOffset = 0;

    /**
     * The width of the band at the edge of the screen the flare fades out over, as a fraction of
     * half the screen size.
     *
     * @attribute
     * @range [0, 1]
     * @precision 2
     * @step 0.01
     */
    edgeFade = 0.2;

    /**
     * Whether the flare keeps drawing while the light is outside the screen, within the edge fade
     * band.
     *
     * @attribute
     */
    allowOffScreen = true;

    /**
     * The distances from the camera a positional light's flare starts and finishes fading out at,
     * in world units. Zero disables the fade.
     *
     * @attribute
     * @type {Vec2}
     */
    fadeDistance = new Vec2(0, 0);

    /**
     * The elements of the flare, drawn in order. The look is rebuilt when a different array is
     * assigned, which is what the Editor does on every edit - assign a new array to change the
     * elements from code.
     *
     * @attribute
     * @type {LensFlareElement[]}
     */
    elements = [];

    /** @private */
    _builtElements = null;

    /**
     * The flare this script drives, created in `initialize`.
     *
     * @type {LensFlare|null}
     */
    flare = null;

    /**
     * The effects the flare is registered with.
     *
     * @type {Set<LensFlareEffect>}
     * @private
     */
    _effects = new Set();

    /**
     * The effects the flare should be registered with this frame, reused.
     *
     * @type {Set<LensFlareEffect>}
     * @private
     */
    _wanted = new Set();

    initialize() {
        const light = this.entity.light ?? null;
        this.flare = new LensFlare(null, light ? { light } : { node: this.entity });
        this.flare.enabled = this.enabled;

        this.on('enable', () => {
            if (this.flare) this.flare.enabled = true;
        });

        this.on('disable', () => {
            if (this.flare) this.flare.enabled = false;
        });

        this.on('destroy', () => {
            this._detach();
            this.flare = null;
        });
    }

    postUpdate() {
        const flare = this.flare;
        if (!flare) return;

        if (this.elements !== this._builtElements) {
            this._builtElements = this.elements;
            flare.look = { elements: (this.elements ?? []).map(element => this._toElement(element)) };
        }

        flare.intensity = this.intensity;
        flare.color.copy(this.color);
        flare.scale = this.scale;
        flare.useLightColor = this.useLightColor;
        flare.occlusionRadius = this.occlusionRadius;
        flare.occlusionFade = this.occlusionFade;
        flare.occlusionOffset = this.occlusionOffset;
        flare.edgeFade = this.edgeFade;
        flare.allowOffScreen = this.allowOffScreen;
        flare.fadeStart = this.fadeDistance.x;
        flare.fadeEnd = this.fadeDistance.y;

        this._attach();
    }

    /**
     * @param {LensFlareElement} element - The element attribute.
     * @returns {object} The element of the look.
     * @private
     */
    _toElement(element) {
        const { color } = element;
        return {
            shape: element.shape,
            offset: element.offset,
            size: element.size,
            aspect: element.aspect,
            rotation: element.rotation,
            autoRotate: element.autoRotate,
            color: color ? [color.r, color.g, color.b] : [1, 1, 1],
            intensity: element.intensity,
            count: element.count,
            spread: element.spread
        };
    }

    /**
     * Registers the flare with the lens flare effect of the chosen camera, or of every camera, as
     * the effects appear, and removes it from the effects the selection no longer covers.
     *
     * @private
     */
    _attach() {
        const wanted = this._wanted;
        wanted.clear();
        if (this.camera) {
            const effect = this._effectOf(this.camera);
            if (effect) wanted.add(effect);
        } else {
            const cameras = this.app.systems.camera.cameras;
            for (let i = 0; i < cameras.length; i++) {
                const effect = this._effectOf(cameras[i].entity);
                if (effect) wanted.add(effect);
            }
        }

        for (const effect of this._effects) {
            if (!wanted.has(effect)) {
                effect.remove(this.flare);
                this._effects.delete(effect);
            }
        }
        for (const effect of wanted) {
            if (!this._effects.has(effect)) {
                effect.add(this.flare);
                this._effects.add(effect);
            }
        }
    }

    /**
     * @param {Entity} cameraEntity - A camera entity.
     * @returns {LensFlareEffect|null} The lens flare effect of its script, or null.
     * @private
     */
    _effectOf(cameraEntity) {
        return cameraEntity.script?.get(LensFlareEffectScript)?.effect ?? null;
    }

    /**
     * Removes the flare from every effect it is registered with.
     *
     * @private
     */
    _detach() {
        for (const effect of this._effects) {
            effect.remove(this.flare);
        }
        this._effects.clear();
    }
}

export { LensFlareEffectScript, LensFlareScript, LensFlareShape, LensFlareElement, ShapeResolution };
