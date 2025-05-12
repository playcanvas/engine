import { Vec3 } from '../../core/math/vec3.js';
import { Quat } from '../../core/math/quat.js';

import {
    GIZMOSPACE_LOCAL,
    GIZMOAXIS_FACE,
    GIZMOAXIS_X,
    GIZMOAXIS_Y,
    GIZMOAXIS_Z
} from './constants.js';
import { TransformGizmo } from './transform-gizmo.js';
import { PlaneShape } from './shape/plane-shape.js';
import { ArrowShape } from './shape/arrow-shape.js';
import { SphereShape } from './shape/sphere-shape.js';

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
        face: new SphereShape(this._device, {
            axis: GIZMOAXIS_FACE,
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
        x: new ArrowShape(this._device, {
            axis: GIZMOAXIS_X,
            layers: [this._layer.id],
            shading: this._shading,
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._meshColors.axis.x,
            hoverColor: this._meshColors.hover.x
        }),
        y: new ArrowShape(this._device, {
            axis: GIZMOAXIS_Y,
            layers: [this._layer.id],
            shading: this._shading,
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._meshColors.axis.y,
            hoverColor: this._meshColors.hover.y
        }),
        z: new ArrowShape(this._device, {
            axis: GIZMOAXIS_Z,
            layers: [this._layer.id],
            shading: this._shading,
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._meshColors.axis.z,
            hoverColor: this._meshColors.hover.z
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
     * Flips the planes to face the camera.
     *
     * @type {boolean}
     */
    flipShapes = true;

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
        super(camera, layer);

        this._createTransform();

        this.on(TransformGizmo.EVENT_TRANSFORMSTART, () => {
            this._storeNodePositions();
        });

        this.on(TransformGizmo.EVENT_TRANSFORMMOVE, (point) => {
            const pointDelta = tmpV3.copy(point).sub(this._selectionStartPoint);
            if (this.snap) {
                pointDelta.mulScalar(1 / this.snapIncrement);
                pointDelta.round();
                pointDelta.mulScalar(this.snapIncrement);
            }
            this._setNodePositions(pointDelta);
        });

        this.on(TransformGizmo.EVENT_NODESDETACH, () => {
            this._nodeLocalPositions.clear();
            this._nodePositions.clear();
        });

        this._app.on('prerender', () => {
            this._shapesLookAtCamera();
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
        this._shapes.face.size = value;
    }

    /**
     * Gets the axis center size.
     *
     * @type {number}
     */
    get axisCenterSize() {
        return this._shapes.face.size;
    }

    /**
     * Sets the axis center tolerance.
     *
     * @type {number}
     */
    set axisCenterTolerance(value) {
        this._shapes.face.tolerance = value;
    }

    /**
     * Gets the axis center tolerance.
     *
     * @type {number}
     */
    get axisCenterTolerance() {
        return this._shapes.face.tolerance;
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
        const facingDir = this.facing;

        // axes
        let dot = facingDir.dot(this.root.right);
        this._shapes.x.entity.enabled = Math.abs(dot) < GLANCE_EPSILON;
        if (this.flipShapes) {
            this._shapes.x.flipped = dot < 0;
        }
        dot = facingDir.dot(this.root.up);
        this._shapes.y.entity.enabled = Math.abs(dot) < GLANCE_EPSILON;
        if (this.flipShapes) {
            this._shapes.y.flipped = dot < 0;
        }
        dot = facingDir.dot(this.root.forward);
        this._shapes.z.entity.enabled = Math.abs(dot) < GLANCE_EPSILON;
        if (this.flipShapes) {
            this._shapes.z.flipped = dot > 0;
        }

        // planes
        tmpV1.cross(facingDir, this.root.right);
        this._shapes.yz.entity.enabled = tmpV1.length() < GLANCE_EPSILON;
        if (this.flipShapes) {
            this._shapes.yz.flipped = tmpV2.set(0, +(tmpV1.dot(this.root.forward) < 0), +(tmpV1.dot(this.root.up) < 0));
        }
        tmpV1.cross(facingDir, this.root.forward);
        this._shapes.xy.entity.enabled = tmpV1.length() < GLANCE_EPSILON;
        if (this.flipShapes) {
            this._shapes.xy.flipped = tmpV2.set(+(tmpV1.dot(this.root.up) < 0), +(tmpV1.dot(this.root.right) > 0), 0);
        }
        tmpV1.cross(facingDir, this.root.up);
        this._shapes.xz.entity.enabled = tmpV1.length() < GLANCE_EPSILON;
        if (this.flipShapes) {
            this._shapes.xz.flipped = tmpV2.set(+(tmpV1.dot(this.root.forward) > 0), 0, +(tmpV1.dot(this.root.right) > 0));
        }
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
     * @param {Vec3} pointDelta - The delta to apply to the node positions.
     * @private
     */
    _setNodePositions(pointDelta) {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];

            if (this._coordSpace === GIZMOSPACE_LOCAL) {
                const pos = this._nodeLocalPositions.get(node);
                if (!pos) {
                    continue;
                }
                tmpV1.copy(pointDelta);
                node.parent?.getWorldTransform().getScale(tmpV2);
                tmpV2.x = 1 / tmpV2.x;
                tmpV2.y = 1 / tmpV2.y;
                tmpV2.z = 1 / tmpV2.z;
                tmpQ1.copy(node.getLocalRotation()).transformVector(tmpV1, tmpV1);
                tmpV1.mul(tmpV2);
                node.setLocalPosition(tmpV1.add(pos));
            } else {
                const pos = this._nodePositions.get(node);
                if (!pos) {
                    continue;
                }
                node.setPosition(tmpV1.copy(pointDelta).add(pos));
            }
        }

        this._updatePosition();
    }

    /**
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @returns {Vec3} The point in world space.
     * @protected
     */
    _screenToPoint(x, y) {
        const mouseWPos = this._camera.screenToWorld(x, y, 1);

        const axis = this._selectedAxis;
        const isPlane = this._selectedIsPlane;

        const ray = this._createRay(mouseWPos);
        const plane = this._createPlane(axis, axis === GIZMOAXIS_FACE, !isPlane);

        const point = new Vec3();

        plane.intersectsRay(ray, point);

        // rotate point back to world coords
        tmpQ1.copy(this._rootStartRot).invert().transformVector(point, point);

        if (!isPlane && axis !== GIZMOAXIS_FACE) {
            this._projectToAxis(point, axis);
        }

        return point;
    }
}

export { TranslateGizmo };
