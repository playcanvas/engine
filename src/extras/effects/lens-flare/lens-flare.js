import { Color } from '../../../core/math/color.js';

/**
 * @import { GraphNode } from '../../../scene/graph-node.js'
 * @import { LightComponent } from '../../../framework/components/light/component.js'
 * @import { Vec3 } from '../../../core/math/vec3.js'
 */

/**
 * One element of a lens flare look, see {@link LensFlareLook}: a shape placed on the axis from the
 * source of the flare through the centre of the screen.
 *
 * @typedef {object} LensFlareElementDesc
 * @property {string} shape - The name of the shape, in the shape library of the
 * {@link LensFlareEffect} the flare is added to.
 * @property {number} [offset] - The position along the axis: 0 at the source, 1 at the centre of
 * the screen, 2 mirrored across the centre, negative beyond the source. Defaults to 0.
 * @property {number} [size] - The height of the element, as a fraction of the screen height.
 * Defaults to 0.1.
 * @property {number} [aspect] - The width of the element relative to its height. Defaults to 1.
 * @property {number} [rotation] - The rotation of the element, in degrees. Defaults to 0.
 * @property {boolean} [autoRotate] - Whether the element is rotated to align with the axis, for
 * streaks. Defaults to false.
 * @property {number[]|Color} [color] - The colour of the element, as a Color or an array of three
 * numbers. Defaults to white.
 * @property {number} [intensity] - The brightness of the element. Defaults to 1.
 * @property {number} [count] - The number of copies of the element, spread along the axis around
 * its offset - a train of ghosts. Defaults to 1.
 * @property {number} [spread] - The distance along the axis the copies are spread over, in the
 * units of the offset. Defaults to 0.
 * @category Graphics
 */

/**
 * The look of a lens flare: the list of its elements. A look is plain data, shared by any number
 * of {@link LensFlare} instances, and can be loaded from a JSON asset.
 *
 * @typedef {object} LensFlareLook
 * @property {LensFlareElementDesc[]} elements - The elements, drawn in order.
 * @category Graphics
 */

/**
 * The options of a {@link LensFlare}, selecting the source its elements follow.
 *
 * @typedef {object} LensFlareOptions
 * @property {LightComponent} [light] - The light the flare belongs to. A directional light gives
 * the direction of the source, an omni or spot light its position, and a spot light also limits
 * the flare to its cone. The colour of the light tints the flare, and its intensity scales it, see
 * {@link LensFlare#useLightColor} and {@link LensFlare#useLightIntensity}.
 * @property {GraphNode} [node] - The node whose position is the source, when the flare has no
 * light.
 * @property {Vec3} [position] - The world position of the source, when the flare has neither a
 * light nor a node.
 * @property {Vec3} [direction] - The world direction towards the source, for a source infinitely
 * far away, when the flare has no light.
 * @category Graphics
 */

// the identifier of the next flare constructed
let uid = 0;

/**
 * A lens flare: a {@link LensFlareLook} placed in the world, following a light or a node. Create
 * one for each light that flares, and add it to the {@link LensFlareEffect} of a camera frame.
 * The properties of the flare are live - changes apply to the next frame rendered - except the
 * look, whose elements are built into the effect when {@link CameraFrame#update} is called.
 *
 * @example
 * const sun = new LensFlare(sunLook, { light: sunEntity.light });
 * sun.occlusionRadius = 0.03;
 * cameraFrame.getEffect('lensFlare').add(sun);
 * cameraFrame.update();
 * @category Graphics
 */
class LensFlare {
    /**
     * Whether the flare is drawn. Defaults to true.
     *
     * @type {boolean}
     */
    enabled = true;

    /**
     * The brightness of the flare, multiplying the intensity of its elements. Defaults to 1.
     *
     * @type {number}
     */
    intensity = 1;

    /**
     * The colour of the flare, tinting its elements. Defaults to white.
     *
     * @type {Color}
     */
    color = new Color(1, 1, 1);

    /**
     * The scale of the flare, multiplying the size of its elements. Defaults to 1.
     *
     * @type {number}
     */
    scale = 1;

    /**
     * Whether the colour of the light the flare belongs to tints the flare. Defaults to true.
     *
     * @type {boolean}
     */
    useLightColor = true;

    /**
     * Whether the intensity of the light the flare belongs to scales the flare, so that the flare
     * dims and brightens with its light, and disappears at an intensity of 0. With
     * {@link Scene#physicalUnits}, the luminance of the light scales the flare instead, as it
     * scales the lighting. Defaults to true.
     *
     * @type {boolean}
     */
    useLightIntensity = true;

    /**
     * The radius around the source the scene depth is tested in to measure how much of the source
     * is visible, as a fraction of the screen height. The flare fades with the fraction. Defaults
     * to 0.02.
     *
     * @type {number}
     */
    occlusionRadius = 0.02;

    /**
     * The time the measured visibility takes to follow a change, in seconds, smoothing the flare
     * as the source is covered and uncovered. Zero follows immediately. Defaults to 0.15.
     *
     * @type {number}
     */
    occlusionFade = 0.15;

    /**
     * The distance the depth test is moved from the source towards the camera, in world units, so
     * that the geometry of the light itself, such as a bulb, does not occlude its own flare.
     * Defaults to 0.
     *
     * @type {number}
     */
    occlusionOffset = 0;

    /**
     * The width of the band at the edge of the screen the flare fades out over as its source
     * leaves the screen, as a fraction of half the screen size. Defaults to 0.2.
     *
     * @type {number}
     */
    edgeFade = 0.2;

    /**
     * Whether the flare keeps drawing while its source is outside the screen, within the edge fade
     * band - the ghosts of a sun just outside the frame. Defaults to true.
     *
     * @type {boolean}
     */
    allowOffScreen = true;

    /**
     * The distance from the camera the flare of a positional source starts to fade out at, in
     * world units. The fade is disabled while {@link LensFlare#fadeEnd} is not greater than this.
     * Defaults to 0.
     *
     * @type {number}
     */
    fadeStart = 0;

    /**
     * The distance from the camera the flare of a positional source is fully faded out at, in
     * world units. Defaults to 0, which disables the fade.
     *
     * @type {number}
     */
    fadeEnd = 0;

    /**
     * The light the flare belongs to, or null. See {@link LensFlareOptions}.
     *
     * @type {LightComponent|null}
     */
    light = null;

    /**
     * The node whose position is the source, or null. See {@link LensFlareOptions}.
     *
     * @type {GraphNode|null}
     */
    node = null;

    /**
     * The world position of the source, or null. See {@link LensFlareOptions}.
     *
     * @type {Vec3|null}
     */
    position = null;

    /**
     * The world direction towards the source, or null. See {@link LensFlareOptions}.
     *
     * @type {Vec3|null}
     */
    direction = null;

    /**
     * A number unique to this instance.
     *
     * @type {number}
     * @ignore
     */
    _uid = uid++;

    /**
     * Incremented whenever the look changes, so that effects can rebuild the elements.
     *
     * @type {number}
     * @ignore
     */
    _version = 0;

    /** @private */
    _look = null;

    /**
     * Creates a new lens flare.
     *
     * @param {LensFlareLook|null} [look] - The look of the flare.
     * @param {LensFlareOptions} [options] - The source the flare follows.
     */
    constructor(look = null, options = {}) {
        this._look = look;
        this.light = options.light ?? null;
        this.node = options.node ?? null;
        this.position = options.position ?? null;
        this.direction = options.direction ?? null;
    }

    /**
     * Sets the look of the flare. Assigning a look, the same object included, rebuilds the
     * elements of the flare at the next {@link CameraFrame#update}, so assign it again after
     * editing the elements in place.
     *
     * @type {LensFlareLook|null}
     */
    set look(value) {
        this._look = value;
        this._version++;
    }

    /**
     * Gets the look of the flare.
     *
     * @type {LensFlareLook|null}
     */
    get look() {
        return this._look;
    }
}

export { LensFlare };
