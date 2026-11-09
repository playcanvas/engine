import { Color } from '../../core/math/color.js';
import { Vec2 } from '../../core/math/vec2.js';
import { CULLFACE_NONE, SEMANTIC_POSITION } from '../../platform/graphics/constants.js';
import { BLEND_NORMAL } from '../../scene/constants.js';
import { PlaneGeometry } from '../../scene/geometry/plane-geometry.js';
import { ShaderMaterial } from '../../scene/materials/shader-material.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { Mesh } from '../../scene/mesh.js';
import { fragmentGLSL, fragmentWGSL, vertexGLSL, vertexWGSL } from './shaders.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

/**
 * @typedef {object} GridTheme
 * @property {{ x: Color, y: Color, z: Color }} axis - The axis line colors.
 * @property {Color} major - The major line color.
 * @property {Color} minor - The minor line color.
 */

/**
 * The plane of a {@link Grid} in its node's local space: 'xz', 'xy' or 'yz'.
 *
 * @typedef {'xz' | 'xy' | 'yz'} GridPlane
 */

// local axes of each plane's u and v coordinates
const PLANES = {
    xz: [[1, 0, 0], [0, 0, 1]],
    xy: [[1, 0, 0], [0, 1, 0]],
    yz: [[0, 1, 0], [0, 0, 1]]
};

/**
 * An anti-aliased reference grid whose levels of lines follow the zoom. It follows the camera and
 * fades out with distance, or is sized by its node's scale when not {@link Grid#infinite}. It lies
 * at its node's position and rotation; use {@link Grid#spacing} to size the cells.
 *
 * ```javascript
 * const grid = new Grid(app.graphicsDevice);
 * entity.addComponent('render', {
 *     meshInstances: grid.meshInstances,
 *     castShadows: false
 * });
 * ```
 *
 * Relevant Engine API examples:
 *
 * - [Grid](https://playcanvas.github.io/#/graphics/grid)
 *
 * @category Graphics
 */
class Grid {
    /**
     * @type {GraphicsDevice}
     * @private
     */
    _device;

    /**
     * @type {ShaderMaterial}
     * @private
     */
    _material;

    /**
     * Writes the depth of the lines.
     *
     * @type {ShaderMaterial}
     * @private
     */
    _depthMaterial;

    /**
     * @type {MeshInstance[]}
     * @private
     */
    _meshInstances;

    /**
     * @type {GridTheme}
     * @private
     */
    _theme = {
        axis: {
            x: new Color(1, 0.3, 0.3),
            y: new Color(0.3, 1, 0.3),
            z: new Color(0.3, 0.3, 1)
        },
        major: new Color(0.8, 0.8, 0.8, 0.6),
        minor: new Color(0.6, 0.6, 0.6, 0.4)
    };

    /**
     * @type {GridPlane}
     * @private
     */
    _plane = 'xz';

    /**
     * @type {boolean}
     * @private
     */
    _showAxes = true;

    /**
     * @type {boolean}
     * @private
     */
    _contrast = false;

    /**
     * @type {number}
     * @private
     */
    _spacing = 10;

    /**
     * @type {number}
     * @private
     */
    _subdivisions = 10;

    /**
     * @type {number}
     * @private
     */
    _majorLineThickness = 1.5;

    /**
     * @type {number}
     * @private
     */
    _minorLineThickness = 1;

    /**
     * @type {number}
     * @private
     */
    _axisLineThickness = 2;

    /**
     * CSS pixels to device pixels.
     *
     * @type {number}
     * @private
     */
    _pixelRatio = 1;

    /**
     * @type {Vec2}
     * @private
     */
    _fadeRange = new Vec2(400, 1000);

    /**
     * @type {boolean}
     * @private
     */
    _infinite = true;

    /**
     * @type {number}
     * @private
     */
    _depthOffset = 0.001;

    /**
     * @type {boolean}
     * @private
     */
    _depthTest = true;

    /**
     * @type {boolean}
     * @private
     */
    _depthWrite = false;

    /**
     * @type {boolean}
     * @private
     */
    _depthDither = false;

    /**
     * @type {boolean}
     * @private
     */
    _visible = true;

    /**
     * Creates a new Grid instance.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @example
     * const grid = new Grid(app.graphicsDevice);
     * grid.spacing = 1;
     * grid.plane = 'xy';
     */
    constructor(device) {
        this._device = device;
        this._updatePixelRatio = this._updatePixelRatio.bind(this);
        device.on('resizecanvas', this._updatePixelRatio);

        this._material = this._createMaterial(false);
        this._depthMaterial = this._createMaterial(true);

        // moved in the vertex shader, so never culled; drawn first of the transparents so its depth
        // can hide them
        const mesh = Mesh.fromGeometry(device, new PlaneGeometry());
        this._meshInstances = [this._material, this._depthMaterial].map((material) => {
            const meshInstance = new MeshInstance(mesh, material);
            meshInstance.cull = false;
            meshInstance.pick = false;
            meshInstance.drawBucket = 255;
            return meshInstance;
        });

        this._updatePlane();
        this._updateColor('uMajorColor', this._theme.major);
        this._updateColor('uMinorColor', this._theme.minor);
        this._setParameter('uSpacing', this._spacing);
        this._updateLevels();
        this._updatePixelRatio();
        this._updateFade();
        this._updateInfinite();
        this._setParameter('uShowAxes', 1);
        this._setParameter('uDepthOffset', this._depthOffset);
        this._updateVisible();
    }

    /**
     * Gets the mesh instances to add to a render component or layer: the lines and their depth
     * pass. They have no node, so set one when adding them to a layer directly.
     *
     * @type {MeshInstance[]}
     */
    get meshInstances() {
        return this._meshInstances;
    }

    /**
     * Gets the theme.
     *
     * @type {GridTheme}
     */
    get theme() {
        return this._theme;
    }

    /**
     * Sets the theme or part of it. Each color's alpha sets its lines' opacity.
     *
     * @param {{ axis?: Partial<GridTheme['axis']>, major?: Color, minor?: Color }} partial - The
     * theme to set.
     * @example
     * grid.setTheme({
     *     axis: { x: new Color(1, 0, 0) },
     *     minor: new Color(0.5, 0.5, 0.5, 0.5)
     * });
     */
    setTheme(partial) {
        const theme = this._theme;
        for (const axis of /** @type {const} */ (['x', 'y', 'z'])) {
            const color = partial?.axis?.[axis];
            if (color instanceof Color) {
                theme.axis[axis].copy(color);
            }
        }
        if (partial?.major instanceof Color) {
            theme.major.copy(partial.major);
        }
        if (partial?.minor instanceof Color) {
            theme.minor.copy(partial.minor);
        }
        this._updatePlane();
        this._updateColor('uMajorColor', theme.major);
        this._updateColor('uMinorColor', theme.minor);
    }

    /**
     * Sets the plane in the node's local space. Defaults to 'xz'.
     *
     * @type {GridPlane}
     */
    set plane(value) {
        if (!PLANES[value]) {
            return;
        }
        this._plane = value;
        this._updatePlane();
    }

    /**
     * Gets the plane.
     *
     * @type {GridPlane}
     */
    get plane() {
        return this._plane;
    }

    /**
     * Sets whether the lines through the origin use the axis colors. Defaults to true.
     *
     * @type {boolean}
     */
    set showAxes(value) {
        this._showAxes = !!value;
        this._setParameter('uShowAxes', this._showAxes ? 1 : 0);
    }

    /**
     * Gets whether the lines through the origin use the axis colors.
     *
     * @type {boolean}
     */
    get showAxes() {
        return this._showAxes;
    }

    /**
     * Sets whether the lines are black over light parts of the scene and white over dark ones,
     * instead of their theme colors. Needs the scene color map, see
     * {@link CameraComponent#requestSceneColorMap}. Defaults to false.
     *
     * @type {boolean}
     */
    set contrast(value) {
        this._contrast = !!value;
        this._material.setDefine('GRID_CONTRAST', this._contrast);
        this._material.update();
    }

    /**
     * Gets whether the lines contrast with the scene.
     *
     * @type {boolean}
     */
    get contrast() {
        return this._contrast;
    }

    /**
     * Sets the cell size the levels are scaled from, in world units. Defaults to 10.
     *
     * @type {number}
     */
    set spacing(value) {
        this._spacing = Math.max(value, 1e-6);
        this._setParameter('uSpacing', this._spacing);
    }

    /**
     * Gets the cell size the levels are scaled from.
     *
     * @type {number}
     */
    get spacing() {
        return this._spacing;
    }

    /**
     * Sets how many cells of a level fit across one of the level above, or 1 for a single fixed
     * level. Defaults to 10.
     *
     * @type {number}
     */
    set subdivisions(value) {
        this._subdivisions = Math.max(value, 1);
        this._updateLevels();
    }

    /**
     * Gets how many cells of a level fit across one of the level above.
     *
     * @type {number}
     */
    get subdivisions() {
        return this._subdivisions;
    }

    /**
     * Sets the major line thickness in CSS pixels. Defaults to 1.5.
     *
     * @type {number}
     */
    set majorLineThickness(value) {
        this._majorLineThickness = value;
        this._updateThickness();
    }

    /**
     * Gets the major line thickness in CSS pixels.
     *
     * @type {number}
     */
    get majorLineThickness() {
        return this._majorLineThickness;
    }

    /**
     * Sets the minor line thickness in CSS pixels. Defaults to 1.
     *
     * @type {number}
     */
    set minorLineThickness(value) {
        this._minorLineThickness = value;
        this._updateThickness();
    }

    /**
     * Gets the minor line thickness in CSS pixels.
     *
     * @type {number}
     */
    get minorLineThickness() {
        return this._minorLineThickness;
    }

    /**
     * Sets the axis line thickness in CSS pixels. Defaults to 2.
     *
     * @type {number}
     */
    set axisLineThickness(value) {
        this._axisLineThickness = value;
        this._updateThickness();
    }

    /**
     * Gets the axis line thickness in CSS pixels.
     *
     * @type {number}
     */
    get axisLineThickness() {
        return this._axisLineThickness;
    }

    /**
     * Sets the distances from the camera where the grid starts and finishes fading out. The end is
     * kept within 90% of the far clip. Defaults to [400, 1000].
     *
     * @type {Vec2}
     */
    set fadeRange(value) {
        this._fadeRange.copy(value);
        this._updateFade();
    }

    /**
     * Gets the distances from the camera where the grid starts and finishes fading out.
     *
     * @type {Vec2}
     */
    get fadeRange() {
        return this._fadeRange;
    }

    /**
     * Sets whether the grid has no edge. When false, it is sized by its node's scale along the
     * plane's axes. Defaults to true.
     *
     * @type {boolean}
     */
    set infinite(value) {
        this._infinite = !!value;
        this._updateInfinite();
    }

    /**
     * Gets whether the grid has no edge.
     *
     * @type {boolean}
     */
    get infinite() {
        return this._infinite;
    }

    /**
     * Sets the fraction of the camera distance the grid's depth moves toward the camera by, so a
     * coplanar surface doesn't hide it. Defaults to 0.001.
     *
     * @type {number}
     */
    set depthOffset(value) {
        this._depthOffset = value;
        this._setParameter('uDepthOffset', value);
    }

    /**
     * Gets the fraction of the camera distance the grid's depth moves toward the camera by.
     *
     * @type {number}
     */
    get depthOffset() {
        return this._depthOffset;
    }

    /**
     * Sets whether the grid is depth tested against the scene. Defaults to true.
     *
     * @type {boolean}
     */
    set depthTest(value) {
        this._depthTest = !!value;
        this._material.depthTest = this._depthTest;
        this._material.update();
        this._depthMaterial.depthTest = this._depthTest;
        this._depthMaterial.update();
    }

    /**
     * Gets whether the grid is depth tested against the scene.
     *
     * @type {boolean}
     */
    get depthTest() {
        return this._depthTest;
    }

    /**
     * Sets whether the lines write depth, hiding transparent meshes and gaussian splats behind
     * them. Defaults to false.
     *
     * @type {boolean}
     */
    set depthWrite(value) {
        this._depthWrite = !!value;
        this._updateVisible();
    }

    /**
     * Gets whether the lines write depth.
     *
     * @type {boolean}
     */
    get depthWrite() {
        return this._depthWrite;
    }

    /**
     * Sets whether the written depth is dithered by line coverage, so faint lines partly hide what
     * is behind them. Suits gaussian splats. Defaults to false.
     *
     * @type {boolean}
     */
    set depthDither(value) {
        this._depthDither = !!value;
        this._depthMaterial.setDefine('GRID_DEPTH_DITHER', this._depthDither);
        this._depthMaterial.update();
    }

    /**
     * Gets whether the written depth is dithered.
     *
     * @type {boolean}
     */
    get depthDither() {
        return this._depthDither;
    }

    /**
     * Sets whether the grid is visible. Defaults to true.
     *
     * @type {boolean}
     */
    set visible(value) {
        this._visible = !!value;
        this._updateVisible();
    }

    /**
     * Gets whether the grid is visible.
     *
     * @type {boolean}
     */
    get visible() {
        return this._visible;
    }

    /**
     * Creates a grid material.
     *
     * @param {boolean} depth - Whether it writes depth instead of color.
     * @returns {ShaderMaterial} The material.
     * @private
     */
    _createMaterial(depth) {
        const material = new ShaderMaterial({
            uniqueName: 'grid',
            vertexGLSL,
            fragmentGLSL,
            vertexWGSL,
            fragmentWGSL,
            attributes: {
                vertex_position: SEMANTIC_POSITION
            }
        });
        // both blended, so they draw after the opaque meshes
        material.cull = CULLFACE_NONE;
        material.blendType = BLEND_NORMAL;
        material.depthWrite = depth;
        if (depth) {
            material.setDefine('GRID_DEPTH', true);
            material.redWrite = false;
            material.greenWrite = false;
            material.blueWrite = false;
            material.alphaWrite = false;
        }
        material.update();
        return material;
    }

    /**
     * Sets a parameter on both materials.
     *
     * @param {string} name - The name of the parameter.
     * @param {number|number[]} value - The value of the parameter.
     * @private
     */
    _setParameter(name, value) {
        this._material.setParameter(name, value);
        this._depthMaterial.setParameter(name, value);
    }

    /**
     * @param {string} name - The name of the parameter.
     * @param {Color} color - The color.
     * @private
     */
    _updateColor(name, color) {
        this._setParameter(name, [color.r, color.g, color.b, color.a]);
    }

    /**
     * @private
     */
    _updatePlane() {
        const plane = this._plane;
        const { axis } = this._theme;
        const [u, v] = PLANES[plane];
        this._setParameter('uAxisU', u);
        this._setParameter('uAxisV', v);
        this._updateColor('uColorU', plane === 'yz' ? axis.y : axis.x);
        this._updateColor('uColorV', plane === 'xy' ? axis.y : axis.z);
    }

    /**
     * @private
     */
    _updateLevels() {
        this._setParameter('uSubdivisions', this._subdivisions);
    }

    /**
     * @private
     */
    _updatePixelRatio() {
        const device = this._device;
        device.updateClientRect();
        const { width } = device.clientRect;
        this._pixelRatio = width > 0 ? device.width / width : 1;
        this._setParameter('uPixelRatio', this._pixelRatio);
        this._updateThickness();
    }

    /**
     * @private
     */
    _updateThickness() {
        const ratio = this._pixelRatio;
        this._setParameter('uThickness', [
            this._majorLineThickness * ratio,
            this._minorLineThickness * ratio,
            this._axisLineThickness * ratio
        ]);
    }

    /**
     * @private
     */
    _updateFade() {
        this._setParameter('uFade', [this._fadeRange.x, this._fadeRange.y]);
    }

    /**
     * @private
     */
    _updateInfinite() {
        this._setParameter('uInfinite', this._infinite ? 1 : 0);
    }

    /**
     * @private
     */
    _updateVisible() {
        this._meshInstances[0].visible = this._visible;
        this._meshInstances[1].visible = this._visible && this._depthWrite;
    }

    /**
     * Destroys the mesh instances and materials. Remove the mesh instances from use first.
     */
    destroy() {
        this._device.off('resizecanvas', this._updatePixelRatio);
        this._meshInstances.forEach(meshInstance => meshInstance.destroy());
        this._material.destroy();
        this._depthMaterial.destroy();
    }
}

export { Grid };
