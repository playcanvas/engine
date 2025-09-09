import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';

import { TransformGizmo } from './transform-gizmo.js';
import { PlaneShape } from './shape/plane-shape.js';
import { ArrowShape } from './shape/arrow-shape.js';
import { SphereShape } from './shape/sphere-shape.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { GraphNode } from '../../scene/graph-node.js'
 * @import { Layer } from '../../scene/layer.js'
 * @import { GizmoAxis } from './constants.js'
 */

// temporary variables
const v1 = new Vec3();
const v2 = new Vec3();
const point = new Vec3();
const delta = new Vec3();
const q = new Quat();

// constants
const GLANCE_EPSILON = 0.01;
const AXES = /** @type {('x' | 'y' | 'z')[]} */ (['x', 'y', 'z']);

/**
 * The TranslateGizmo provides interactive 3D manipulation handles for translating/moving
 * {@link Entity}s in a {@link Scene}. It creates a visual widget with arrows along the X, Y
 * and Z axes, planes at their intersections, and a center sphere, allowing precise control over
 * object positioning through direct manipulation. The gizmo's visual appearance can be customized
 * away from the defaults as required.
 *
 * Note that the gizmo can be driven by both mouse+keyboard and touch input.
 *
 * ```javascript
 * // Create a layer for rendering all gizmos
 * const gizmoLayer = pc.Gizmo.createLayer(app);
 *
 * // Create a translate gizmo
 * const gizmo = new pc.TranslateGizmo(cameraComponent, gizmoLayer);
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
 * - [Translate Gizmo](https://playcanvas.github.io/#/gizmos/transform-translate)
 * - [Editor](https://playcanvas.github.io/#/misc/editor)
 *
 * @category Gizmo
 */
class TranslateGizmo extends TransformGizmo {
    _shapes = {
        xyz: new SphereShape(this._device, {
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
        x: new ArrowShape(this._device, {
            axis: 'x',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._theme.shapeBase.x,
            hoverColor: this._theme.shapeHover.x,
            disabledColor: this._theme.disabled
        }),
        y: new ArrowShape(this._device, {
            axis: 'y',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._theme.shapeBase.y,
            hoverColor: this._theme.shapeHover.y,
            disabledColor: this._theme.disabled
        }),
        z: new ArrowShape(this._device, {
            axis: 'z',
            layers: [this._layer.id],
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._theme.shapeBase.z,
            hoverColor: this._theme.shapeHover.z,
            disabledColor: this._theme.disabled
        })
    };

    /**
     * Internal mapping from each attached node to their starting position in local space.
     *
     * @type {Map<GraphNode, Vec3>}
     * @private
     */
    _nodeLocalPositions = new Map();

    /**
     * Internal mapping from each attached node to their starting position in world space.
     *
     * @type {Map<GraphNode, Vec3>}
     * @private
     */
    _nodePositions = new Map();

    /**
     * @override
     */
    snapIncrement = 1;

    /**
     * Whether to flip the axes to face the camera.
     *
     * @type {boolean}
     */
    flipAxes = true;

    /**
     * Flips the planes to face the camera.
     *
     * @type {boolean}
     */
    flipPlanes = true;

    /**
     * Creates a new TranslateGizmo object. Use {@link Gizmo.createLayer} to create the layer
     * required to display the gizmo.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The layer responsible for rendering the gizmo.
     * @example
     * const gizmo = new pc.TranslateGizmo(camera, layer);
     */
    constructor(camera, layer) {
        super(camera, layer, 'gizmo:translate');

        this._createTransform();

        this.on(TransformGizmo.EVENT_TRANSFORMSTART, () => {
            // store the initial positions of the nodes
            this._storeNodePositions();

            // hide shapes that are not selected
            this._drag(true);
        });

        this.on(TransformGizmo.EVENT_TRANSFORMMOVE, (point) => {
            // calculate translate delta and update node positions
            const translateDelta = delta.copy(point).sub(this._selectionStartPoint);
            if (this.snap) {
                translateDelta.mulScalar(1 / this.snapIncrement);
                translateDelta.round();
                translateDelta.mulScalar(this.snapIncrement);
            }
            this._setNodePositions(translateDelta);
        });

        this.on(TransformGizmo.EVENT_TRANSFORMEND, () => {
            // show all shapes
            this._drag(false);
        });

        this.on(TransformGizmo.EVENT_NODESDETACH, () => {
            // reset stored positions
            this._nodeLocalPositions.clear();
            this._nodePositions.clear();
        });
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
     * Sets the arrow thickness.
     *
     * @type {number}
     */
    set axisArrowThickness(value) {
        this._setArrowProp('arrowThickness', value);
    }

    /**
     * Gets the arrow thickness.
     *
     * @type {number}
     */
    get axisArrowThickness() {
        return this._shapes.x.arrowThickness;
    }

    /**
     * Sets the arrow length.
     *
     * @type {number}
     */
    set axisArrowLength(value) {
        this._setArrowProp('arrowLength', value);
    }

    /**
     * Gets the arrow length.
     *
     * @type {number}
     */
    get axisArrowLength() {
        return this._shapes.x.arrowLength;
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
        this._shapes.xyz.radius = value;
    }

    /**
     * Gets the axis center size.
     *
     * @type {number}
     */
    get axisCenterSize() {
        return this._shapes.xyz.radius;
    }

    /**
     * Sets the axis center tolerance.
     *
     * @type {number}
     */
    set axisCenterTolerance(value) {
        this._shapes.xyz.tolerance = value;
    }

    /**
     * Gets the axis center tolerance.
     *
     * @type {number}
     */
    get axisCenterTolerance() {
        return this._shapes.xyz.tolerance;
    }

    /**
     * @type {boolean}
     * @deprecated Use {@link TranslateGizmo#flipAxes} or {@link TranslateGizmo#flipPlanes} instead.
     * @ignore
     */
    set flipShapes(value) {
        this.flipAxes = value;
        this.flipPlanes = value;
    }

    /**
     * @type {boolean}
     * @deprecated Use {@link TranslateGizmo#flipAxes} or {@link TranslateGizmo#flipPlanes} instead.
     * @ignore
     */
    get flipShapes() {
        return this.flipAxes && this.flipPlanes;
    }

    /**
     * @param {string} prop - The property to set.
     * @param {any} value - The value to set.
     * @private
     */
    _setArrowProp(prop, value) {
        this._shapes.x[prop] = value;
        this._shapes.y[prop] = value;
        this._shapes.z[prop] = value;
    }

    /**
     * @param {string} prop - The property to set.
     * @param {any} value - The value to set.
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
        if (this.flipAxes) {
            this._shapes.x.flipped = dot < 0;
        }
        dot = cameraDir.dot(this.root.up);
        this._shapes.y.entity.enabled = 1 - Math.abs(dot) > GLANCE_EPSILON;
        if (this.flipAxes) {
            this._shapes.y.flipped = dot < 0;
        }
        dot = cameraDir.dot(this.root.forward);
        this._shapes.z.entity.enabled = 1 - Math.abs(dot) > GLANCE_EPSILON;
        if (this.flipAxes) {
            this._shapes.z.flipped = dot > 0;
        }

        // planes
        v1.cross(cameraDir, this.root.right);
        this._shapes.yz.entity.enabled = 1 - v1.length() > GLANCE_EPSILON;
        if (this.flipPlanes) {
            this._shapes.yz.flipped = v2.set(0, +(v1.dot(this.root.forward) < 0), +(v1.dot(this.root.up) < 0));
        }
        v1.cross(cameraDir, this.root.forward);
        this._shapes.xy.entity.enabled = 1 - v1.length() > GLANCE_EPSILON;
        if (this.flipPlanes) {
            this._shapes.xy.flipped = v2.set(+(v1.dot(this.root.up) < 0), +(v1.dot(this.root.right) > 0), 0);
        }
        v1.cross(cameraDir, this.root.up);
        this._shapes.xz.entity.enabled = 1 - v1.length() > GLANCE_EPSILON;
        if (this.flipPlanes) {
            this._shapes.xz.flipped = v2.set(+(v1.dot(this.root.forward) > 0), 0, +(v1.dot(this.root.right) > 0));
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
                }
            }
        }

        this.fire(TransformGizmo.EVENT_RENDERUPDATE);
    }

    /**
     * @private
     */
    _storeNodePositions() {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            this._nodeLocalPositions.set(node, node.getLocalPosition().clone());
            this._nodePositions.set(node, node.getPosition().clone());
        }
    }

    /**
     * @param {Vec3} translateDelta - The delta to apply to the node positions.
     * @private
     */
    _setNodePositions(translateDelta) {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];

            if (this._coordSpace === 'local') {
                const pos = this._nodeLocalPositions.get(node);
                if (!pos) {
                    continue;
                }
                v1.copy(translateDelta);
                node.parent?.getWorldTransform().getScale(v2);
                v2.x = 1 / v2.x;
                v2.y = 1 / v2.y;
                v2.z = 1 / v2.z;
                q.copy(node.getLocalRotation()).transformVector(v1, v1);
                v1.mul(v2);
                node.setLocalPosition(v1.add(pos));
            } else {
                const pos = this._nodePositions.get(node);
                if (!pos) {
                    continue;
                }
                node.setPosition(v1.copy(translateDelta).add(pos));
            }
        }

        this._updatePosition();
    }

    /**
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @returns {Vec3} The point (space is {@link TransformGizmo#coordSpace}).
     * @protected
     */
    _screenToPoint(x, y) {
        const mouseWPos = this._camera.screenToWorld(x, y, 1);

        const axis = this._selectedAxis;
        const isPlane = this._selectedIsPlane;

        const ray = this._createRay(mouseWPos);
        const plane = this._createPlane(axis, axis === 'xyz', !isPlane);
        if (!plane.intersectsRay(ray, point)) {
            return point;
        }

        // rotate point back to world coords
        q.copy(this._rootStartRot).invert().transformVector(point, point);

        // project point onto axis
        if (!isPlane && axis !== 'xyz') {
            this._projectToAxis(point, axis);
        }

        return point;
    }

    /**
     * @param {Vec3} pos - The position.
     * @param {Quat} rot - The rotation.
     * @param {GizmoAxis} activeAxis - The active axis.
     * @param {boolean} activeIsPlane - Whether the active axis is a plane.
     * @override
     */
    _drawGuideLines(pos, rot, activeAxis, activeIsPlane) {
        for (const axis of AXES) {
            if (this._dragging || activeAxis === 'xyz') {
                this._drawSpanLine(pos, rot, axis);
                continue;
            }
            if (activeIsPlane) {
                if (axis !== activeAxis) {
                    this._drawSpanLine(pos, rot, axis);
                }
            } else {
                if (axis === activeAxis) {
                    this._drawSpanLine(pos, rot, axis);
                }
            }
        }
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

export { TranslateGizmo };
