import { Color } from '../../core/math/color.js';
import { Vec2 } from '../../core/math/vec2.js';
import { CULLFACE_NONE, SEMANTIC_POSITION } from '../../platform/graphics/constants.js';
import { BLEND_NORMAL } from '../../scene/constants.js';
import { PlaneGeometry } from '../../scene/geometry/plane-geometry.js';
import { ShaderMaterial } from '../../scene/materials/shader-material.js';
import { MeshInstance } from '../../scene/mesh-instance.js';
import { Mesh } from '../../scene/mesh.js';
import { fragmentGLSL, fragmentWGSL, vertexGLSL, vertexWGSL } from './grid-shaders.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

/**
 * @typedef {object} GridTheme
 * @property {{ x: Color, y: Color, z: Color }} axis - The colors of the lines through the origin
 * along each axis.
 * @property {Color} major - The color of the major lines.
 * @property {Color} minor - The color of the minor lines.
 */

/**
 * The plane of an {@link Grid}, in the local space of the node it is drawn at. This can be
 * one of the following:
 *
 * - 'xz': The XZ plane, a ground plane
 * - 'xy': The XY plane, facing Z
 * - 'yz': The YZ plane, facing X
 *
 * @typedef {'xz' | 'xy' | 'yz'} GridPlane
 */

// the local axes of the grid's u and v coordinates on each plane
const PLANES = {
    xz: [[1, 0, 0], [0, 0, 1]],
    xy: [[1, 0, 0], [0, 1, 0]],
    yz: [[0, 1, 0], [0, 0, 1]]
};

/**
 * Draws an anti-aliased reference grid using the "pristine grid" technique. The levels of lines
 * follow the zoom, as in Blender: each level's cells are {@link Grid#spacing} times a
 * power of {@link Grid#subdivisions}, the finest fades in as its cells grow on screen and
 * the coarser ones turn major, so the grid keeps the same density at any distance. The lines
 * through the origin are drawn in the color of their axis, and lines keep their thickness in
 * pixels. By default the grid has no edge: the
 * plane follows each camera that renders it and fades out with the distance from that camera.
 * Clear {@link Grid#infinite} for a grid of {@link Grid#size}.
 *
 * The grid lies at the position and rotation of the node of its mesh instances; the node's scale
 * is ignored, so use {@link Grid#spacing} to size the cells.
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
     * Material of the depth pass, which writes the depth of the lines with no color.
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
     * @type {Vec2}
     * @private
     */
    _size = new Vec2(20, 20);

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

        // the plane moves with the camera in the vertex shader, so its bounds mean nothing, and it
        // draws first of the transparent meshes, so its depth can hide those drawn after it
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
        this._updateSize();
        this._setParameter('uShowAxes', 1);
        this._setParameter('uDepthOffset', this._depthOffset);
        this._updateVisible();
    }

    /**
     * Gets the mesh instances of the grid: the lines, and the pass that writes their depth when
     * {@link Grid#depthWrite} is set. Add both to a render component or a layer. They have
     * no node, so a render component gives them its entity; give them one when adding them to a
     * layer directly.
     *
     * @type {MeshInstance[]}
     */
    get meshInstances() {
        return this._meshInstances;
    }

    /**
     * Gets the current theme for the grid.
     *
     * @type {GridTheme}
     */
    get theme() {
        return this._theme;
    }

    /**
     * Sets the theme or partial theme for the grid. The alpha of each color scales the opacity of
     * its lines.
     *
     * @param {{ axis?: Partial<GridTheme['axis']>, major?: Color, minor?: Color }} partial - The
     * partial theme to set.
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
     * Sets the plane the grid lies on, in the local space of its node. Defaults to 'xz'.
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
     * Gets the plane the grid lies on.
     *
     * @type {GridPlane}
     */
    get plane() {
        return this._plane;
    }

    /**
     * Sets whether the lines through the origin are drawn in the colors of their axes. Defaults
     * to true.
     *
     * @type {boolean}
     */
    set showAxes(value) {
        this._showAxes = !!value;
        this._setParameter('uShowAxes', this._showAxes ? 1 : 0);
    }

    /**
     * Gets whether the lines through the origin are drawn in the colors of their axes.
     *
     * @type {boolean}
     */
    get showAxes() {
        return this._showAxes;
    }

    /**
     * Sets whether the lines take a contrasting color from the scene behind them instead of their
     * theme color: black over a light part of the scene and white over a dark one, so they read
     * against anything. The lines through the origin keep their axis colors, and the theme alpha
     * still sets the opacity. The camera must capture the scene color, see
     * {@link CameraComponent#renderSceneColorMap}. Defaults to false.
     *
     * @type {boolean}
     */
    set contrast(value) {
        this._contrast = !!value;
        this._material.setDefine('GRID_CONTRAST', this._contrast);
        this._material.update();
    }

    /**
     * Gets whether the lines take a contrasting color from the scene behind them.
     *
     * @type {boolean}
     */
    get contrast() {
        return this._contrast;
    }

    /**
     * Sets the cell size in world units the levels of lines are scaled from: each level's cells are
     * this times a power of {@link Grid#subdivisions}. Defaults to 10.
     *
     * @type {number}
     */
    set spacing(value) {
        this._spacing = Math.max(value, 1e-6);
        this._setParameter('uSpacing', this._spacing);
    }

    /**
     * Gets the size of the major cells in world units.
     *
     * @type {number}
     */
    get spacing() {
        return this._spacing;
    }

    /**
     * Sets how many cells of each level span a cell of the level above. Set to 1 for a single fixed
     * level of cells of {@link Grid#spacing} that doesn't follow the zoom. Defaults to 10.
     *
     * @type {number}
     */
    set subdivisions(value) {
        this._subdivisions = Math.max(value, 1);
        this._updateLevels();
    }

    /**
     * Gets how many cells of each level span a cell of the level above.
     *
     * @type {number}
     */
    get subdivisions() {
        return this._subdivisions;
    }

    /**
     * Sets the thickness of the major lines in CSS pixels. Defaults to 1.5.
     *
     * @type {number}
     */
    set majorLineThickness(value) {
        this._majorLineThickness = value;
        this._updateThickness();
    }

    /**
     * Gets the thickness of the major lines in CSS pixels.
     *
     * @type {number}
     */
    get majorLineThickness() {
        return this._majorLineThickness;
    }

    /**
     * Sets the thickness of the minor lines in CSS pixels. Defaults to 1.
     *
     * @type {number}
     */
    set minorLineThickness(value) {
        this._minorLineThickness = value;
        this._updateThickness();
    }

    /**
     * Gets the thickness of the minor lines in CSS pixels.
     *
     * @type {number}
     */
    get minorLineThickness() {
        return this._minorLineThickness;
    }

    /**
     * Sets the thickness of the lines through the origin in CSS pixels. Defaults to 2.
     *
     * @type {number}
     */
    set axisLineThickness(value) {
        this._axisLineThickness = value;
        this._updateThickness();
    }

    /**
     * Gets the thickness of the lines through the origin in CSS pixels.
     *
     * @type {number}
     */
    get axisLineThickness() {
        return this._axisLineThickness;
    }

    /**
     * Sets the distances from the camera, in world units, where the grid starts to fade out and
     * where it has faded out completely. A larger gap between them fades the grid more softly; with
     * no gap the grid stops with a hard edge. An infinite grid ends at the far distance, which is
     * held inside 90% of the camera's far clip, so the far clip never cuts the grid. Defaults to
     * [400, 1000].
     *
     * @type {Vec2}
     */
    set fadeRange(value) {
        this._fadeRange.copy(value);
        this._updateFade();
    }

    /**
     * Gets the distances from the camera where the grid starts to fade out and has faded out.
     *
     * @type {Vec2}
     */
    get fadeRange() {
        return this._fadeRange;
    }

    /**
     * Sets whether the grid has no edge, following the camera. When false, the grid is
     * {@link Grid#size} and centered on its node. Defaults to true.
     *
     * @type {boolean}
     */
    set infinite(value) {
        this._infinite = !!value;
        this._updateSize();
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
     * Sets the size of the grid in world units along the two axes of its plane (x and z on the
     * 'xz' plane), used when {@link Grid#infinite} is false. Defaults to [20, 20].
     *
     * @type {Vec2}
     */
    set size(value) {
        this._size.copy(value);
        this._updateSize();
    }

    /**
     * Gets the size of the grid in world units along the two axes of its plane.
     *
     * @type {Vec2}
     */
    get size() {
        return this._size;
    }

    /**
     * Sets the fraction of the distance to the camera the grid's depth is moved toward it by. The
     * grid stays where it is on screen, but a surface on the grid's plane, such as a floor, no
     * longer hides it, while what stands on that surface still does. Defaults to 0.001, which
     * moves the grid 1 cm toward a camera 10 m away.
     *
     * @type {number}
     */
    set depthOffset(value) {
        this._depthOffset = value;
        this._setParameter('uDepthOffset', value);
    }

    /**
     * Gets the fraction of the distance to the camera the grid's depth is moved toward it by.
     *
     * @type {number}
     */
    get depthOffset() {
        return this._depthOffset;
    }

    /**
     * Sets whether the scene hides the grid where it is in front of it. Defaults to true.
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
     * Gets whether the scene hides the grid where it is in front of it.
     *
     * @type {boolean}
     */
    get depthTest() {
        return this._depthTest;
    }

    /**
     * Sets whether the grid writes its depth, so it hides what draws after it, such as
     * transparent meshes and gaussian splats behind it. The grid draws first of the transparent
     * meshes of a layer sorted back to front. Only lines covering most of a pixel write depth, so
     * faint and distant lines hide nothing. Defaults to false.
     *
     * @type {boolean}
     */
    set depthWrite(value) {
        this._depthWrite = !!value;
        this._updateVisible();
    }

    /**
     * Gets whether the grid writes its depth.
     *
     * @type {boolean}
     */
    get depthWrite() {
        return this._depthWrite;
    }

    /**
     * Sets whether the depth the grid writes is dithered by how much of each pixel its lines cover,
     * so faint and distant lines hide a share of what is behind them instead of none of it. Suits
     * gaussian splats, which blend with no depth of their own. When false, only lines covering most
     * of a pixel write depth, which keeps the lines clean over meshes. Applies when
     * {@link Grid#depthWrite} is set. Defaults to false.
     *
     * @type {boolean}
     */
    set depthDither(value) {
        this._depthDither = !!value;
        this._depthMaterial.setDefine('GRID_DEPTH_DITHER', this._depthDither);
        this._depthMaterial.update();
    }

    /**
     * Gets whether the depth the grid writes is dithered.
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
     * Creates a material of the grid.
     *
     * @param {boolean} depth - Whether the material writes the depth of the lines instead of
     * their color.
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
        // both draw with the transparent meshes, after the opaque ones the depth must not hide
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

    /** @private */
    _updatePlane() {
        const plane = this._plane;
        const { axis } = this._theme;
        const [u, v] = PLANES[plane];
        this._setParameter('uAxisU', u);
        this._setParameter('uAxisV', v);
        this._updateColor('uColorU', plane === 'yz' ? axis.y : axis.x);
        this._updateColor('uColorV', plane === 'xy' ? axis.y : axis.z);
    }

    /** @private */
    _updateLevels() {
        this._setParameter('uSubdivisions', this._subdivisions);
    }

    /**
     * Reads the ratio of device to CSS pixels the canvas is drawn at.
     *
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

    /** @private */
    _updateThickness() {
        const ratio = this._pixelRatio;
        this._setParameter('uThickness', [
            this._majorLineThickness * ratio,
            this._minorLineThickness * ratio,
            this._axisLineThickness * ratio
        ]);
    }

    /** @private */
    _updateFade() {
        this._setParameter('uFade', [this._fadeRange.x, this._fadeRange.y]);
    }

    /** @private */
    _updateSize() {
        const size = this._infinite ? Vec2.ZERO : this._size;
        this._setParameter('uExtent', [size.x, size.y]);
    }

    /** @private */
    _updateVisible() {
        this._meshInstances[0].visible = this._visible;
        this._meshInstances[1].visible = this._visible && this._depthWrite;
    }

    /**
     * Destroys the grid's mesh instances and materials. Remove the mesh instances from any render
     * component or layer first.
     */
    destroy() {
        this._device.off('resizecanvas', this._updatePixelRatio);
        this._meshInstances.forEach(meshInstance => meshInstance.destroy());
        this._material.destroy();
        this._depthMaterial.destroy();
    }
}

export { Grid };
