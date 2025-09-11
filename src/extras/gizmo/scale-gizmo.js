import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';

import { TransformGizmo } from './transform-gizmo.js';
import { BoxShape } from './shape/box-shape.js';
import { PlaneShape } from './shape/plane-shape.js';
import { BoxLineShape } from './shape/boxline-shape.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { GraphNode } from '../../scene/graph-node.js'
 * @import { Layer } from '../../scene/layer.js'
 * @import { GizmoSpace } from './constants.js'
 */

// temporary variables
const v1 = new Vec3();
const v2 = new Vec3();
const point = new Vec3();
const delta = new Vec3();
const q = new Quat();

// constants
const GLANCE_EPSILON = 0.01;

/**
 * The ScaleGizmo provides interactive 3D manipulation handles for scaling/resizing
 * {@link Entity}s in a {@link Scene}. It creates a visual widget with box-tipped lines along the
 * X, Y and Z axes, planes at their intersections, and a center box, allowing precise control over
 * object scaling through direct manipulation. The gizmo's visual appearance can be customized
 * away from the defaults as required.
 *
 * Note that the gizmo can be driven by both mouse+keyboard and touch input.
 *
 * ```javascript
 * // Create a layer for rendering all gizmos
 * const gizmoLayer = pc.Gizmo.createLayer(app);
 *
 * // Create a scale gizmo
 * const gizmo = new pc.ScaleGizmo(cameraComponent, gizmoLayer);
 *
 * // Create an entity to attach the gizmo to
 * const entity = new pc.Entity();
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
            disabledColor: this._theme.disabled
        }),
        xz: new PlaneShape(this._device, {
            axis: 'y',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._theme.shapeBase.y,
            hoverColor: this._theme.shapeHover.y,
            disabledColor: this._theme.disabled
        }),
        xy: new PlaneShape(this._device, {
            axis: 'z',
            layers: [this._layer.id],
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._theme.shapeBase.z,
            hoverColor: this._theme.shapeHover.z,
            disabledColor: this._theme.disabled
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
     * Internal mapping from each attached node to their starting scale.
     *
     * @type {Map<GraphNode, Vec3>}
     * @private
     */
    _nodeScales = new Map();

    /**
     * Internal state if transform should use uniform scaling.
     *
     * @type {boolean}
     * @protected
     */
    _uniform = false;

    /**
     * @override
     */
    snapIncrement = 1;

    /**
     * Flips the planes to face the camera.
     *
     * @type {boolean}
     */
    flipPlanes = true;

    /**
     * The lower bound for scaling.
     *
     * @type {Vec3}
     */
    lowerBoundScale = new Vec3(-Infinity, -Infinity, -Infinity);

    /**
     * Creates a new ScaleGizmo object. Use {@link Gizmo.createLayer} to create the layer
     * required to display the gizmo.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The layer responsible for rendering the gizmo.
     * @example
     * const gizmo = new pc.ScaleGizmo(camera, layer);
     */
    constructor(camera, layer) {
        super(camera, layer, 'gizmo:scale');

        this._createTransform();

        this.on(TransformGizmo.EVENT_TRANSFORMSTART, () => {
            // store initial scales of nodes
            this._storeNodeScales();

            // hide shapes that are not selected
            this._drag(true);
        });

        this.on(TransformGizmo.EVENT_TRANSFORMMOVE, (point) => {
            // calculate scale delta and update node scales
            const scaleDelta = delta.copy(point).sub(this._selectionStartPoint);
            if (this.snap) {
                scaleDelta.mulScalar(1 / this.snapIncrement);
                scaleDelta.round();
                scaleDelta.mulScalar(this.snapIncrement);
            }
            scaleDelta.mulScalar(1 / this._scale);
            this._setNodeScales(scaleDelta.add(Vec3.ONE));
        });

        this.on(TransformGizmo.EVENT_TRANSFORMEND, () => {
            // show all shapes
            this._drag(false);
        });

        this.on(TransformGizmo.EVENT_NODESDETACH, () => {
            // reset stored scales
            this._nodeScales.clear();
        });
    }

    set coordSpace(value) {
        // disallow changing coordSpace for scale
    }

    get coordSpace() {
        return this._coordSpace;
    }

    /**
     * Sets the uniform scaling state for planes.
     *
     * @type {boolean}
     */
    set uniform(value) {
        this._uniform = value ?? this._uniform;
    }

    /**
     * Gets the uniform scaling state for planes.
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
     * @deprecated Use {@link ScaleGizmo#flipPlanes} instead.
     * @ignore
     */
    set flipShapes(value) {
        this.flipPlanes = value;
    }

    /**
     * @type {boolean}
     * @deprecated Use {@link ScaleGizmo#flipPlanes} instead.
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

        // axes
        let dot = cameraDir.dot(this.root.right);
        this._shapes.x.entity.enabled = 1 - Math.abs(dot) > GLANCE_EPSILON;
        dot = cameraDir.dot(this.root.up);
        this._shapes.y.entity.enabled = 1 - Math.abs(dot) > GLANCE_EPSILON;
        dot = cameraDir.dot(this.root.forward);
        this._shapes.z.entity.enabled = 1 - Math.abs(dot) > GLANCE_EPSILON;

        // planes
        v1.cross(cameraDir, this.root.right);
        this._shapes.yz.entity.enabled = 1 - v1.length() > GLANCE_EPSILON;
        this._shapes.yz.flipped = this.flipPlanes ? v2.set(0, +(v1.dot(this.root.forward) < 0), +(v1.dot(this.root.up) < 0)) : Vec3.ZERO;
        v1.cross(cameraDir, this.root.forward);
        this._shapes.xy.entity.enabled = 1 - v1.length() > GLANCE_EPSILON;
        this._shapes.xy.flipped = this.flipPlanes ? v2.set(+(v1.dot(this.root.up) < 0), +(v1.dot(this.root.right) > 0), 0) : Vec3.ZERO;
        v1.cross(cameraDir, this.root.up);
        this._shapes.xz.entity.enabled = 1 - v1.length() > GLANCE_EPSILON;
        this._shapes.xz.flipped = this.flipPlanes ? v2.set(+(v1.dot(this.root.forward) > 0), 0, +(v1.dot(this.root.right) > 0)) : Vec3.ZERO;
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

        this.fire(TransformGizmo.EVENT_RENDERUPDATE);
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
     * @param {Vec3} scaleDelta - The point delta.
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

        // uniform scaling for XYZ axis
        if (axis === 'xyz') {
            // calculate projection vector for scale direction
            const projDir = v2.add2(this._camera.entity.up, this._camera.entity.right).normalize();

            // calculate direction vector for scaling
            const dir = v1.sub2(point, gizmoPos);

            // normalize vector and project it to scale direction
            const v = dir.length() * dir.normalize().dot(projDir);
            point.set(v, v, v);

            return point;
        }

        // rotate point back to world coords
        q.copy(this._rootStartRot).invert().transformVector(point, point);

        // project point onto axis
        if (!isPlane) {
            this._projectToAxis(point, axis);
        }

        // uniform scaling for planes
        if (this._uniform && isPlane) {
            // project to diagonal line
            v1.set(1, 1, 1);
            v1[axis] = 0;
            point.copy(v1.mulScalar(v1.dot(point)));
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
