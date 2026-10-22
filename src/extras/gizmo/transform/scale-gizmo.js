import { Vec3 } from '../../../core/math/vec3.js';
import { Quat } from '../../../core/math/quat.js';

import { TransformGizmo } from './transform-gizmo.js';
import { BoxShape } from '../shape/box-shape.js';
import { PlaneShape } from '../shape/plane-shape.js';
import { BoxLineShape } from '../shape/boxline-shape.js';

/**
 * @import { CameraComponent } from '../../../framework/components/camera/component.js'
 * @import { GraphNode } from '../../../scene/graph-node.js'
 * @import { Layer } from '../../../scene/layer.js'
 * @import { GizmoSpace } from '../constants.js'
 */

const v1 = new Vec3();
const v2 = new Vec3();
const point = new Vec3();
const delta = new Vec3();
const q = new Quat();

/**
 * Handles for scaling {@link Entity}s: box-tipped lines along the X, Y and Z axes, planes between
 * them and a center box that scales uniformly. Works with mouse, keyboard and touch input.
 *
 * ```javascript
 * // Create a layer for rendering all gizmos
 * const gizmoLayer = Gizmo.createLayer(app);
 *
 * // Create a scale gizmo
 * const gizmo = new ScaleGizmo(cameraComponent, gizmoLayer);
 *
 * // Create an entity to attach the gizmo to
 * const entity = new Entity();
 * entity.addComponent('render', {
 *     type: 'box'
 * });
 * app.root.addChild(entity);
 *
 * // Attach the gizmo to the entity
 * gizmo.attach([entity]);
 * ```
 *
 * Relevant Engine API examples:
 *
 * - [Scale Gizmo](https://playcanvas.github.io/#/gizmos/transform-scale)
 * - [Editor](https://playcanvas.github.io/#/misc/editor)
 *
 * @category Gizmo
 */
class ScaleGizmo extends TransformGizmo {
    _shapes = {
        xyz: new BoxShape(this._device, {
            axis: 'xyz',
            layers: [this._layer.id],
            defaultColor: this._theme.shapeBase.xyz,
            hoverColor: this._theme.shapeHover.xyz,
            disabledColor: this._theme.disabled
        }),
        yz: new PlaneShape(this._device, {
            axis: 'x',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._theme.shapeBase.x,
            hoverColor: this._theme.shapeHover.x,
            disabledColor: this._theme.disabled,
            depth: 1
        }),
        xz: new PlaneShape(this._device, {
            axis: 'y',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._theme.shapeBase.y,
            hoverColor: this._theme.shapeHover.y,
            disabledColor: this._theme.disabled,
            depth: 1
        }),
        xy: new PlaneShape(this._device, {
            axis: 'z',
            layers: [this._layer.id],
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._theme.shapeBase.z,
            hoverColor: this._theme.shapeHover.z,
            disabledColor: this._theme.disabled,
            depth: 1
        }),
        x: new BoxLineShape(this._device, {
            axis: 'x',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._theme.shapeBase.x,
            hoverColor: this._theme.shapeHover.x,
            disabledColor: this._theme.disabled
        }),
        y: new BoxLineShape(this._device, {
            axis: 'y',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._theme.shapeBase.y,
            hoverColor: this._theme.shapeHover.y,
            disabledColor: this._theme.disabled
        }),
        z: new BoxLineShape(this._device, {
            axis: 'z',
            layers: [this._layer.id],
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._theme.shapeBase.z,
            hoverColor: this._theme.shapeHover.z,
            disabledColor: this._theme.disabled
        })
    };

    /**
     * @type {GizmoSpace}
     * @protected
     */
    _coordSpace = 'local';

    /**
     * The local scale of each attached node at the start of a drag.
     *
     * @type {Map<GraphNode, Vec3>}
     * @private
     */
    _nodeScales = new Map();

    /**
     * Whether planes scale uniformly.
     *
     * @protected
     */
    _uniform = false;

    /**
     * Flips the planes to face the camera.
     */
    flipPlanes = true;

    /**
     * The lower bound for scaling.
     */
    lowerBoundScale = new Vec3(-Infinity, -Infinity, -Infinity);

    /**
     * Creates a new ScaleGizmo object. Use {@link Gizmo.createLayer} to create its layer.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The layer responsible for rendering the gizmo.
     * @example
     * const gizmo = new ScaleGizmo(camera, layer);
     */
    constructor(camera, layer) {
        super(camera, layer, 'gizmo:scale');

        this._createTransform();

        this.on(TransformGizmo.EVENT_TRANSFORMSTART, () => {
            this._storeNodeScales();

            // hide the unselected shapes
            this._drag(true);

            this.fire(TransformGizmo.EVENT_TRANSFORMREADOUT, this._selectedAxis, this._selectedIsPlane, Vec3.ONE);
        });

        this.on(TransformGizmo.EVENT_TRANSFORMMOVE, (point) => {
            const scaleDelta = delta.copy(point).sub(this._selectionStartPoint).mulScalar(1 / this._scale);
            this._snapVector(scaleDelta, this.snapIncrement);
            this._setNodeScales(scaleDelta.add(Vec3.ONE));

            this.fire(TransformGizmo.EVENT_TRANSFORMREADOUT, this._selectedAxis, this._selectedIsPlane, scaleDelta);
        });

        this.on(TransformGizmo.EVENT_TRANSFORMREADOUT, (_axis, _isPlane, value) => {
            if (!this._readout) {
                return;
            }
            this._showReadout(this._readoutAxes(value, true));
        });

        this.on(TransformGizmo.EVENT_TRANSFORMEND, () => {

            // show all shapes
            this._drag(false);
        });

        this.on(TransformGizmo.EVENT_NODESDETACH, () => {
            this._nodeScales.clear();
        });
    }

    set coordSpace(value) {

        // scale always uses local space
    }

    get coordSpace() {
        return this._coordSpace;
    }

    /**
     * Sets whether planes scale uniformly.
     *
     * @type {boolean}
     */
    set uniform(value) {
        this._uniform = value ?? this._uniform;
    }

    /**
     * Gets whether planes scale uniformly.
     *
     * @type {boolean}
     */
    get uniform() {
        return this._uniform;
    }

    /**
     * Sets the axis gap.
     *
     * @type {number}
     */
    set axisGap(value) {
        this._setArrowProp('gap', value);
    }

    /**
     * Gets the axis gap.
     *
     * @type {number}
     */
    get axisGap() {
        return this._shapes.x.gap;
    }

    /**
     * Sets the axis line thickness.
     *
     * @type {number}
     */
    set axisLineThickness(value) {
        this._setArrowProp('lineThickness', value);
    }

    /**
     * Gets the axis line thickness.
     *
     * @type {number}
     */
    get axisLineThickness() {
        return this._shapes.x.lineThickness;
    }

    /**
     * Sets the axis line length.
     *
     * @type {number}
     */
    set axisLineLength(value) {
        this._setArrowProp('lineLength', value);
    }

    /**
     * Gets the axis line length.
     *
     * @type {number}
     */
    get axisLineLength() {
        return this._shapes.x.lineLength;
    }

    /**
     * Sets the axis line tolerance.
     *
     * @type {number}
     */
    set axisLineTolerance(value) {
        this._setArrowProp('tolerance', value);
    }

    /**
     * Gets the axis line tolerance.
     *
     * @type {number}
     */
    get axisLineTolerance() {
        return this._shapes.x.tolerance;
    }

    /**
     * Sets the axis box size.
     *
     * @type {number}
     */
    set axisBoxSize(value) {
        this._setArrowProp('boxSize', value);
    }

    /**
     * Gets the axis box size.
     *
     * @type {number}
     */
    get axisBoxSize() {
        return this._shapes.x.boxSize;
    }

    /**
     * Sets the plane size.
     *
     * @type {number}
     */
    set axisPlaneSize(value) {
        this._setPlaneProp('size', value);
    }

    /**
     * Gets the plane size.
     *
     * @type {number}
     */
    get axisPlaneSize() {
        return this._shapes.yz.size;
    }

    /**
     * Sets the plane gap.
     *
     * @type {number}
     */
    set axisPlaneGap(value) {
        this._setPlaneProp('gap', value);
    }

    /**
     * Gets the plane gap.
     *
     * @type {number}
     */
    get axisPlaneGap() {
        return this._shapes.yz.gap;
    }

    /**
     * Sets the plane fill opacity, as a factor of the theme color alpha. Defaults to 0.35.
     *
     * @type {number}
     */
    set axisPlaneOpacity(value) {
        this._setPlaneProp('opacity', value);
    }

    /**
     * Gets the plane fill opacity.
     *
     * @type {number}
     */
    get axisPlaneOpacity() {
        return this._shapes.yz.opacity;
    }

    /**
     * Sets the plane outline thickness; 0 hides the outline. Defaults to 0.01.
     *
     * @type {number}
     */
    set axisPlaneOutlineThickness(value) {
        this._setPlaneProp('outlineThickness', value);
    }

    /**
     * Gets the plane outline thickness.
     *
     * @type {number}
     */
    get axisPlaneOutlineThickness() {
        return this._shapes.yz.outlineThickness;
    }

    /**
     * Sets the view angle in degrees below which an axis or plane fades out, hiding at about 8
     * degrees. Defaults to 25.
     *
     * @type {number}
     */
    set axisFadeAngle(value) {
        this._fadeAngle = value ?? this._fadeAngle;
        this._shapesLookAtCamera();
    }

    /**
     * Gets the angle in degrees below which an axis or plane fades out.
     *
     * @type {number}
     */
    get axisFadeAngle() {
        return this._fadeAngle;
    }

    /**
     * Sets the axis center size.
     *
     * @type {number}
     */
    set axisCenterSize(value) {
        this._shapes.xyz.size = value;
    }

    /**
     * Gets the axis center size.
     *
     * @type {number}
     */
    get axisCenterSize() {
        return this._shapes.xyz.size;
    }

    /**
     * @type {boolean}
     * @deprecated Use {@link flipPlanes} instead.
     * @ignore
     */
    set flipShapes(value) {
        this.flipPlanes = value;
    }

    /**
     * @type {boolean}
     * @deprecated Use {@link flipPlanes} instead.
     * @ignore
     */
    get flipShapes() {
        return this.flipPlanes;
    }

    /**
     * @param {string} prop - The property name.
     * @param {any} value - The property value.
     * @private
     */
    _setArrowProp(prop, value) {
        this._shapes.x[prop] = value;
        this._shapes.y[prop] = value;
        this._shapes.z[prop] = value;
    }

    /**
     * @param {string} prop - The property name.
     * @param {any} value - The property value.
     * @private
     */
    _setPlaneProp(prop, value) {
        this._shapes.yz[prop] = value;
        this._shapes.xz[prop] = value;
        this._shapes.xy[prop] = value;
    }

    /**
     * @private
     */
    _shapesLookAtCamera() {
        const cameraDir = this.cameraDir;

        // axes and planes fade out as the view looks along them
        let changed = this._glance(this._shapes.x, Math.abs(cameraDir.dot(this.root.right)));
        changed = this._glance(this._shapes.y, Math.abs(cameraDir.dot(this.root.up))) || changed;
        changed = this._glance(this._shapes.z, Math.abs(cameraDir.dot(this.root.forward))) || changed;

        let flipped;
        v1.cross(cameraDir, this.root.right);
        changed = this._glance(this._shapes.yz, v1.length()) || changed;
        flipped = this.flipPlanes ? v2.set(0, +(v1.dot(this.root.forward) < 0), +(v1.dot(this.root.up) < 0)) : Vec3.ZERO;
        if (!this._shapes.yz.flipped.equals(flipped)) {
            this._shapes.yz.flipped = flipped;
            changed = true;
        }
        v1.cross(cameraDir, this.root.forward);
        changed = this._glance(this._shapes.xy, v1.length()) || changed;
        flipped = this.flipPlanes ? v2.set(+(v1.dot(this.root.up) < 0), +(v1.dot(this.root.right) > 0), 0) : Vec3.ZERO;
        if (!this._shapes.xy.flipped.equals(flipped)) {
            this._shapes.xy.flipped = flipped;
            changed = true;
        }
        v1.cross(cameraDir, this.root.up);
        changed = this._glance(this._shapes.xz, v1.length()) || changed;
        flipped = this.flipPlanes ? v2.set(+(v1.dot(this.root.forward) > 0), 0, +(v1.dot(this.root.right) > 0)) : Vec3.ZERO;
        if (!this._shapes.xz.flipped.equals(flipped)) {
            this._shapes.xz.flipped = flipped;
            changed = true;
        }

        if (changed) {
            this._renderUpdate = true;
        }
    }

    /**
     * @param {boolean} state - The state.
     * @private
     */
    _drag(state) {
        for (const axis in this._shapes) {
            const shape = this._shapes[axis];
            switch (this.dragMode) {
                case 'show': {
                    continue;
                }
                case 'hide': {
                    shape.visible = !state;
                    continue;
                }
                case 'selected': {
                    if (this._selectedAxis === 'xyz') {
                        shape.visible = state ? axis.length === 1 : true;
                        continue;
                    }
                    if (this._selectedIsPlane) {
                        shape.visible = state ? axis.length === 1 && !axis.includes(this._selectedAxis) : true;
                        continue;
                    }
                    shape.visible = state ? axis === this._selectedAxis : true;
                    continue;
                }
            }
        }

        this._renderUpdate = true;
    }

    /**
     * @private
     */
    _storeNodeScales() {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            this._nodeScales.set(node, node.getLocalScale().clone());
        }
    }

    /**
     * @param {Vec3} scaleDelta - The scale factor.
     * @private
     */
    _setNodeScales(scaleDelta) {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            const scale = this._nodeScales.get(node);
            if (!scale) {
                continue;
            }
            node.setLocalScale(v1.copy(scale).mul(scaleDelta).max(this.lowerBoundScale));
        }
    }

    /**
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @returns {Vec3} The point (space is {@link TransformGizmo#coordSpace}).
     * @protected
     */
    _screenToPoint(x, y) {
        const gizmoPos = this.root.getLocalPosition();
        const mouseWPos = this._camera.screenToWorld(x, y, 1);

        const axis = this._selectedAxis;
        const isPlane = this._selectedIsPlane;

        const ray = this._createRay(mouseWPos);
        const plane = this._createPlane(axis, axis === 'xyz', !isPlane);
        if (!plane.intersectsRay(ray, point)) {
            return point;
        }

        // the center box scales uniformly, by the drag along the screen diagonal
        if (axis === 'xyz') {
            const projDir = v2.add2(this._camera.entity.up, this._camera.entity.right).normalize();
            const dir = v1.sub2(point, gizmoPos);
            const v = dir.length() * dir.normalize().dot(projDir);
            point.set(v, v, v);

            return point;
        }

        // into the frame of the gizmo at the start of the drag
        q.copy(this._rootStartRot).invert().transformVector(point, point);

        if (!isPlane) {
            this._projectToAxis(point, axis);
        }

        // uniform plane scaling projects onto the diagonal
        if (this._uniform && isPlane) {
            v1.set(1, 1, 1);
            v1[axis] = 0;
            point.copy(v1.mulScalar(v1.dot(point) / v1.lengthSq()));
            point[axis] = 0;
        }

        return point;
    }

    /**
     * @override
     */
    prerender() {
        super.prerender();

        if (!this.enabled) {
            return;
        }

        this._shapesLookAtCamera();
    }
}

export { ScaleGizmo };
