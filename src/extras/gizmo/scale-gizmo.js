import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';

import { GIZMOSPACE_LOCAL, GIZMOAXIS_X, GIZMOAXIS_XYZ, GIZMOAXIS_Y, GIZMOAXIS_Z } from './constants.js';
import { TransformGizmo } from './transform-gizmo.js';
import { BoxShape } from './shape/box-shape.js';
import { PlaneShape } from './shape/plane-shape.js';
import { BoxLineShape } from './shape/boxline-shape.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { GraphNode } from '../../scene/graph-node.js'
 * @import { Layer } from '../../scene/layer.js'
 */

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();
const tmpQ1 = new Quat();

// constants
const GLANCE_EPSILON = 0.98;

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
            axis: GIZMOAXIS_XYZ,
            layers: [this._layer.id],
            shading: this._shading,
            defaultColor: this._meshColors.axis.xyz,
            hoverColor: this._meshColors.hover.xyz
        }),
        yz: new PlaneShape(this._device, {
            axis: GIZMOAXIS_X,
            layers: [this._layer.id],
            shading: this._shading,
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._meshColors.axis.x,
            hoverColor: this._meshColors.hover.x
        }),
        xz: new PlaneShape(this._device, {
            axis: GIZMOAXIS_Y,
            layers: [this._layer.id],
            shading: this._shading,
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._meshColors.axis.y,
            hoverColor: this._meshColors.hover.y
        }),
        xy: new PlaneShape(this._device, {
            axis: GIZMOAXIS_Z,
            layers: [this._layer.id],
            shading: this._shading,
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._meshColors.axis.z,
            hoverColor: this._meshColors.hover.z
        }),
        x: new BoxLineShape(this._device, {
            axis: GIZMOAXIS_X,
            layers: [this._layer.id],
            shading: this._shading,
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._meshColors.axis.x,
            hoverColor: this._meshColors.hover.x
        }),
        y: new BoxLineShape(this._device, {
            axis: GIZMOAXIS_Y,
            layers: [this._layer.id],
            shading: this._shading,
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._meshColors.axis.y,
            hoverColor: this._meshColors.hover.y
        }),
        z: new BoxLineShape(this._device, {
            axis: GIZMOAXIS_Z,
            layers: [this._layer.id],
            shading: this._shading,
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._meshColors.axis.z,
            hoverColor: this._meshColors.hover.z
        })
    };

    _coordSpace = GIZMOSPACE_LOCAL;

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
    _useUniformScaling = false;

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
     * Whether to hide the shapes when dragging.
     *
     * @type {'show' | 'hide' | 'selected'}
     */
    dragMode = 'show';

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
        super(camera, layer);

        this._createTransform();

        this.on(TransformGizmo.EVENT_TRANSFORMSTART, () => {
            // store initial scales of nodes
            this._storeNodeScales();

            // hide shapes that are not selected
            this._drag(true);
        });

        this.on(TransformGizmo.EVENT_TRANSFORMMOVE, (point) => {
            const pointDelta = tmpV3.copy(point).sub(this._selectionStartPoint);
            if (this.snap) {
                pointDelta.mulScalar(1 / this.snapIncrement);
                pointDelta.round();
                pointDelta.mulScalar(this.snapIncrement);
            }
            pointDelta.mulScalar(1 / this._scale);
            this._setNodeScales(pointDelta.add(Vec3.ONE));
        });

        this.on(TransformGizmo.EVENT_TRANSFORMEND, () => {
            this._drag(false);
        });

        this.on(TransformGizmo.EVENT_NODESDETACH, () => {
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
        this._useUniformScaling = value ?? true;
    }

    /**
     * Gets the uniform scaling state for planes.
     *
     * @type {boolean}
     */
    get uniform() {
        return this._useUniformScaling;
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
        this._shapes.x.entity.enabled = Math.abs(dot) < GLANCE_EPSILON;
        if (this.flipAxes) {
            this._shapes.x.flipped = dot < 0;
        }
        dot = cameraDir.dot(this.root.up);
        this._shapes.y.entity.enabled = Math.abs(dot) < GLANCE_EPSILON;
        if (this.flipAxes) {
            this._shapes.y.flipped = dot < 0;
        }
        dot = cameraDir.dot(this.root.forward);
        this._shapes.z.entity.enabled = Math.abs(dot) < GLANCE_EPSILON;
        if (this.flipAxes) {
            this._shapes.z.flipped = dot > 0;
        }

        // planes
        tmpV1.cross(cameraDir, this.root.right);
        this._shapes.yz.entity.enabled = tmpV1.length() < GLANCE_EPSILON;
        if (this.flipPlanes) {
            this._shapes.yz.flipped = tmpV2.set(0, +(tmpV1.dot(this.root.forward) < 0), +(tmpV1.dot(this.root.up) < 0));
        }
        tmpV1.cross(cameraDir, this.root.forward);
        this._shapes.xy.entity.enabled = tmpV1.length() < GLANCE_EPSILON;
        if (this.flipPlanes) {
            this._shapes.xy.flipped = tmpV2.set(+(tmpV1.dot(this.root.up) < 0), +(tmpV1.dot(this.root.right) > 0), 0);
        }
        tmpV1.cross(cameraDir, this.root.up);
        this._shapes.xz.entity.enabled = tmpV1.length() < GLANCE_EPSILON;
        if (this.flipPlanes) {
            this._shapes.xz.flipped = tmpV2.set(+(tmpV1.dot(this.root.forward) > 0), 0, +(tmpV1.dot(this.root.right) > 0));
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
                    // all axes
                    if (this._selectedAxis === GIZMOAXIS_XYZ) {
                        shape.visible = state ? axis.length === 1 : true;
                        continue;
                    }
                    // planes
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
     * @param {Vec3} pointDelta - The point delta.
     * @private
     */
    _setNodeScales(pointDelta) {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            const scale = this._nodeScales.get(node);
            if (!scale) {
                continue;
            }
            node.setLocalScale(tmpV1.copy(scale).mul(pointDelta).max(this.lowerBoundScale));
        }
    }

    /**
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @returns {Vec3} The point in world space.
     * @protected
     */
    _screenToPoint(x, y) {
        const gizmoPos = this.root.getPosition();
        const mouseWPos = this._camera.screenToWorld(x, y, 1);

        const axis = this._selectedAxis;

        const isPlane = this._selectedIsPlane;
        const isScaleUniform = (this._useUniformScaling && isPlane) || axis === GIZMOAXIS_XYZ;

        const ray = this._createRay(mouseWPos);
        const plane = this._createPlane(axis, isScaleUniform, !isPlane);

        const point = new Vec3();

        plane.intersectsRay(ray, point);

        if (isScaleUniform) {
            // calculate projecion vector for scale direction
            switch (axis) {
                case GIZMOAXIS_X:
                    tmpV1.copy(this.root.up);
                    tmpV2.copy(this.root.forward).mulScalar(-1);
                    break;
                case GIZMOAXIS_Y:
                    tmpV1.copy(this.root.right);
                    tmpV2.copy(this.root.forward).mulScalar(-1);
                    break;
                case GIZMOAXIS_Z:
                    tmpV1.copy(this.root.up);
                    tmpV2.copy(this.root.right);
                    break;
                default:
                    // defaults to all axes
                    tmpV1.copy(this._camera.entity.up);
                    tmpV2.copy(this._camera.entity.right);
                    break;
            }
            tmpV2.add(tmpV1).normalize();
            tmpV1.sub2(point, gizmoPos);
            const length = tmpV1.length();
            const v = length * tmpV1.normalize().dot(tmpV2);
            point.set(v, v, v);

            // keep scale of axis constant if not all axes are selected
            if (axis !== GIZMOAXIS_XYZ) {
                point[axis] = 1;
            }

            return point;
        }

        // rotate point back to world coords
        tmpQ1.copy(this._rootStartRot).invert().transformVector(point, point);

        if (!isPlane) {
            this._projectToAxis(point, axis);
        }

        return point;
    }

    /**
     * @override
     */
    prerender() {
        super.prerender();

        if (!this.root.enabled) {
            return;
        }

        this._shapesLookAtCamera();
    }
}

export { ScaleGizmo };
