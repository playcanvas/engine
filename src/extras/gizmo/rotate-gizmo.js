import { math } from '../../core/math/math.js';
import { Color } from '../../core/math/color.js';
import { Quat } from '../../core/math/quat.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { PROJECTION_PERSPECTIVE } from '../../scene/constants.js';

import { ArcShape } from './shape/arc-shape.js';
import { GIZMOSPACE_LOCAL, GIZMOAXIS_FACE, GIZMOAXIS_X, GIZMOAXIS_Y, GIZMOAXIS_Z } from './constants.js';
import { TransformGizmo } from './transform-gizmo.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { GraphNode } from '../../scene/graph-node.js'
 * @import { Layer } from '../../scene/layer.js'
 */

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();
const tmpV4 = new Vec3();
const tmpM1 = new Mat4();
const tmpQ1 = new Quat();
const tmpQ2 = new Quat();

// constants
const FACING_THRESHOLD = 0.9;
const GUIDE_ANGLE_COLOR = new Color(0, 0, 0, 0.3);

/**
 * The RotateGizmo provides interactive 3D manipulation handles for rotating/reorienting
 * {@link Entity}s in a {@link Scene}. It creates a visual widget with a draggable ring for each
 * axis of rotation, plus a fourth ring for rotation in the camera's view plane, allowing precise
 * control over object orientation through direct manipulation. The gizmo's visual appearance can
 * be customized away from the defaults as required.
 *
 * Note that the gizmo can be driven by both mouse+keyboard and touch input.
 *
 * ```javascript
 * // Create a layer for rendering all gizmos
 * const gizmoLayer = pc.Gizmo.createLayer(app);
 *
 * // Create a rotate gizmo
 * const gizmo = new pc.RotateGizmo(cameraComponent, gizmoLayer);
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
 * - [Rotate Gizmo](https://playcanvas.github.io/#/gizmos/transform-rotate)
 * - [Editor](https://playcanvas.github.io/#/misc/editor)
 *
 * @category Gizmo
 */
class RotateGizmo extends TransformGizmo {
    _shapes = {
        z: new ArcShape(this._device, {
            axis: GIZMOAXIS_Z,
            layers: [this._layer.id],
            shading: this._shading,
            rotation: new Vec3(90, 0, 90),
            defaultColor: this._theme.shapeBase.z,
            hoverColor: this._theme.shapeHover.z,
            sectorAngle: 180
        }),
        x: new ArcShape(this._device, {
            axis: GIZMOAXIS_X,
            layers: [this._layer.id],
            shading: this._shading,
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._theme.shapeBase.x,
            hoverColor: this._theme.shapeHover.x,
            sectorAngle: 180
        }),
        y: new ArcShape(this._device, {
            axis: GIZMOAXIS_Y,
            layers: [this._layer.id],
            shading: this._shading,
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._theme.shapeBase.y,
            hoverColor: this._theme.shapeHover.y,
            sectorAngle: 180
        }),
        face: new ArcShape(this._device, {
            axis: GIZMOAXIS_FACE,
            layers: [this._layer.id],
            shading: this._shading,
            rotation: this._getLookAtEulerAngles(this._camera.entity.getPosition()),
            defaultColor: this._theme.shapeBase.f,
            hoverColor: this._theme.shapeHover.f,
            ringRadius: 0.55
        })
    };

    /**
     * Internal selection starting angle in world space.
     *
     * @type {number}
     * @private
     */
    _selectionStartAngle = 0;

    /**
     * Internal mapping from each attached node to their starting rotation in local space.
     *
     * @type {Map<GraphNode, Quat>}
     * @private
     */
    _nodeLocalRotations = new Map();

    /**
     * Internal mapping from each attached node to their starting rotation in world space.
     *
     * @type {Map<GraphNode, Quat>}
     * @private
     */
    _nodeRotations = new Map();

    /**
     * Internal mapping from each attached node to their offset position from the gizmo.
     *
     * @type {Map<GraphNode, Vec3>}
     * @private
     */
    _nodeOffsets = new Map();

    /**
     * Internal color for guide angle starting line.
     *
     * @type {Color}
     * @private
     */
    _guideAngleStartColor = GUIDE_ANGLE_COLOR.clone();

    /**
     * Internal vector for the start point of the guide line angle.
     *
     * @type {Vec3}
     * @private
     */
    _guideAngleStart = new Vec3();

    /**
     * Internal vector for the end point of the guide line angle.
     *
     * @type {Vec3}
     * @private
     */
    _guideAngleEnd = new Vec3();

    /**
     * @override
     */
    snapIncrement = 5;

    /**
     * This forces the rotation to always be calculated based on the mouse position around the gizmo.
     *
     * @type {boolean}
     */
    orbitRotation = false;

    /**
     * Creates a new RotateGizmo object. Use {@link Gizmo.createLayer} to create the layer
     * required to display the gizmo.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The layer responsible for rendering the gizmo.
     * @example
     * const gizmo = new pc.RotateGizmo(camera, layer);
     */
    constructor(camera, layer) {
        super(camera, layer);

        this._createTransform();

        this.on(TransformGizmo.EVENT_TRANSFORMSTART, (point, x, y) => {
            // store start angle
            this._selectionStartAngle = this._calculateAngle(point, x, y);

            // store initial node rotations
            this._storeNodeRotations();

            // store guide points
            this._storeGuidePoints();

            // drag handle for disk (arc <-> circle)
            this._drag(true);
        });

        this.on(TransformGizmo.EVENT_TRANSFORMMOVE, (point, x, y) => {
            const axis = this._selectedAxis;

            let angleDelta = this._calculateAngle(point, x, y) - this._selectionStartAngle;
            if (this.snap) {
                angleDelta = Math.round(angleDelta / this.snapIncrement) * this.snapIncrement;
            }
            this._setNodeRotations(axis, angleDelta);

            this._updateGuidePoints(angleDelta);
        });

        this.on(TransformGizmo.EVENT_TRANSFORMEND, () => {
            this._drag(false);
        });

        this.on(TransformGizmo.EVENT_NODESDETACH, () => {
            this._nodeLocalRotations.clear();
            this._nodeRotations.clear();
            this._nodeOffsets.clear();
        });
    }

    /**
     * Sets the XYZ tube radius.
     *
     * @type {number}
     */
    set xyzTubeRadius(value) {
        this._setDiskProp('tubeRadius', value);
    }

    /**
     * Gets the XYZ tube radius.
     *
     * @type {number}
     */
    get xyzTubeRadius() {
        return this._shapes.x.tubeRadius;
    }

    /**
     * Sets the XYZ ring radius.
     *
     * @type {number}
     */
    set xyzRingRadius(value) {
        this._setDiskProp('ringRadius', value);
    }

    /**
     * Gets the XYZ ring radius.
     *
     * @type {number}
     */
    get xyzRingRadius() {
        return this._shapes.x.ringRadius;
    }

    /**
     * Sets the face tube radius.
     *
     * @type {number}
     */
    set faceTubeRadius(value) {
        this._shapes.face.tubeRadius = value;
    }

    /**
     * Gets the face tube radius.
     *
     * @type {number}
     */
    get faceTubeRadius() {
        return this._shapes.face.tubeRadius;
    }

    /**
     * Sets the face ring radius.
     *
     * @type {number}
     */
    set faceRingRadius(value) {
        this._shapes.face.ringRadius = value;
    }

    /**
     * Gets the face ring radius.
     *
     * @type {number}
     */
    get faceRingRadius() {
        return this._shapes.face.ringRadius;
    }

    /**
     * Sets the ring tolerance.
     *
     * @type {number}
     */
    set ringTolerance(value) {
        this._setDiskProp('tolerance', value);
        this._shapes.face.tolerance = value;
    }

    /**
     * Gets the ring tolerance.
     *
     * @type {number}
     */
    get ringTolerance() {
        return this._shapes.x.tolerance;
    }

    /**
     * @param {string} prop - The property.
     * @param {any} value - The value.
     * @private
     */
    _setDiskProp(prop, value) {
        this._shapes.x[prop] = value;
        this._shapes.y[prop] = value;
        this._shapes.z[prop] = value;
    }

    /**
     * @private
     */
    _storeGuidePoints() {
        const gizmoPos = this.root.getPosition();
        const axis = this._selectedAxis;
        const isFacing = axis === GIZMOAXIS_FACE;
        const scale = isFacing ? this.faceRingRadius : this.xyzRingRadius;

        this._guideAngleStart.copy(this._selectionStartPoint).sub(gizmoPos).normalize();
        this._guideAngleStart.mulScalar(scale);
        this._guideAngleEnd.copy(this._guideAngleStart);
    }

    /**
     * @param {number} angleDelta - The angle delta.
     * @private
     */
    _updateGuidePoints(angleDelta) {
        const axis = this._selectedAxis;
        const isFacing = axis === GIZMOAXIS_FACE;

        if (isFacing) {
            tmpV1.copy(this.facingDir);
        } else {
            tmpV1.set(0, 0, 0);
            tmpV1[axis] = 1;
            this._rootStartRot.transformVector(tmpV1, tmpV1);
        }
        tmpQ1.setFromAxisAngle(tmpV1, angleDelta);
        tmpQ1.transformVector(this._guideAngleStart, this._guideAngleEnd);
    }

    /**
     * @param {Vec3} pos - The position.
     * @param {string} axis - The axis.
     * @param {Vec3} point - The point.
     * @param {Color} [color] - The color.
     * @private
     */
    _drawGuideAngleLine(pos, axis, point, color = this._theme.guideBase[axis]) {
        tmpV1.set(0, 0, 0);
        tmpV2.copy(point).mulScalar(this._scale);
        this._app.drawLine(tmpV1.add(pos), tmpV2.add(pos), color, false, this._layer);
    }

    /**
     * @param {Vec3} position - The position.
     * @returns {Vec3} The look at euler angles.
     * @private
     */
    _getLookAtEulerAngles(position) {
        tmpV1.set(0, 0, 0);
        tmpM1.setLookAt(tmpV1, position, Vec3.UP);
        tmpQ1.setFromMat4(tmpM1);
        tmpQ1.getEulerAngles(tmpV1);
        tmpV1.x += 90;
        return tmpV1;
    }

    /**
     * @private
     */
    _shapesLookAtCamera() {
        // face shape
        if (this._camera.projection === PROJECTION_PERSPECTIVE) {
            this._shapes.face.entity.lookAt(this._camera.entity.getPosition());
            this._shapes.face.entity.rotateLocal(90, 0, 0);
        } else {
            tmpQ1.copy(this._camera.entity.getRotation()).getEulerAngles(tmpV1);
            this._shapes.face.entity.setEulerAngles(tmpV1);
            this._shapes.face.entity.rotateLocal(-90, 0, 0);
        }

        // axes shapes
        const facingDir = tmpV1.copy(this.facingDir);
        tmpQ1.copy(this.root.getRotation()).invert().transformVector(facingDir, facingDir);
        let angle = Math.atan2(facingDir.z, facingDir.y) * math.RAD_TO_DEG;
        this._shapes.x.entity.setLocalEulerAngles(0, angle - 90, -90);
        angle = Math.atan2(facingDir.x, facingDir.z) * math.RAD_TO_DEG;
        this._shapes.y.entity.setLocalEulerAngles(0, angle, 0);
        angle = Math.atan2(facingDir.y, facingDir.x) * math.RAD_TO_DEG;
        this._shapes.z.entity.setLocalEulerAngles(90, 0, angle + 90);
    }

    /**
     * @param {boolean} state - The state.
     * @private
     */
    _drag(state) {
        for (const axis in this._shapes) {
            const shape = this._shapes[axis];
            if (axis === this._selectedAxis) {
                shape.drag(state);
            } else {
                shape.hide(state);
            }
        }
        this.fire(TransformGizmo.EVENT_RENDERUPDATE);
    }

    /**
     * @private
     */
    _storeNodeRotations() {
        const gizmoPos = this.root.getPosition();
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            this._nodeLocalRotations.set(node, node.getLocalRotation().clone());
            this._nodeRotations.set(node, node.getRotation().clone());
            this._nodeOffsets.set(node, node.getPosition().clone().sub(gizmoPos));
        }
    }

    /**
     * @param {string} axis - The axis.
     * @param {number} angleDelta - The angle delta.
     * @private
     */
    _setNodeRotations(axis, angleDelta) {
        const gizmoPos = this.root.getPosition();
        const isFacing = axis === GIZMOAXIS_FACE;

        // calculate rotation from axis and angle
        tmpQ1.setFromAxisAngle(this._dirFromAxis(axis, tmpV1), angleDelta);

        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            if (!isFacing && this._coordSpace === GIZMOSPACE_LOCAL) {
                const rot = this._nodeLocalRotations.get(node);
                if (!rot) {
                    continue;
                }
                tmpQ2.copy(rot).mul(tmpQ1);
                node.setLocalRotation(tmpQ2);
            } else {
                const rot = this._nodeRotations.get(node);
                if (!rot) {
                    continue;
                }
                const offset = this._nodeOffsets.get(node);
                if (!offset) {
                    continue;
                }
                tmpV1.copy(offset);
                tmpQ1.transformVector(tmpV1, tmpV1);
                tmpQ2.copy(tmpQ1).mul(rot);

                // N.B. Rotation via quaternion when scale inverted causes scale warping?
                node.setEulerAngles(tmpQ2.getEulerAngles());
                node.setPosition(tmpV1.add(gizmoPos));
            }
        }

        if (this._coordSpace === GIZMOSPACE_LOCAL) {
            this._updateRotation();
        }
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

        const ray = this._createRay(mouseWPos);
        const plane = this._createPlane(axis, axis === GIZMOAXIS_FACE, false);

        const point = new Vec3();

        plane.intersectsRay(ray, point);

        return point;
    }

    /**
     * @param {Vec3} point - The point.
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @returns {number} The angle.
     * @protected
     */
    _calculateAngle(point, x, y) {
        const gizmoPos = this.root.getPosition();

        const axis = this._selectedAxis;

        const plane = this._createPlane(axis, axis === GIZMOAXIS_FACE, false);

        let angle = 0;

        // calculate angle
        const facingDir = tmpV2.copy(this.facingDir);
        const facingDot = plane.normal.dot(facingDir);
        if (this.orbitRotation || Math.abs(facingDot) > FACING_THRESHOLD) {
            // plane facing camera so based on mouse position around gizmo
            tmpV1.sub2(point, gizmoPos);

            // transform point so it's facing the camera
            tmpQ1.copy(this._camera.entity.getRotation()).invert().transformVector(tmpV1, tmpV1);

            // calculate angle
            angle = Math.sign(facingDot) * Math.atan2(tmpV1.y, tmpV1.x) * math.RAD_TO_DEG;
        } else {
            // convert rotation axis to screen space
            tmpV1.copy(gizmoPos);
            tmpV2.cross(plane.normal, facingDir).normalize().add(gizmoPos);

            // convert world space vectors to screen space
            this._camera.worldToScreen(tmpV1, tmpV3);
            this._camera.worldToScreen(tmpV2, tmpV4);

            // angle is dot product with mouse position
            tmpV1.sub2(tmpV4, tmpV3).normalize();
            tmpV2.set(x, y, 0);
            angle = tmpV1.dot(tmpV2);
        }

        return angle;
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

        if (this._dragging) {
            const gizmoPos = this.root.getPosition();
            this._drawGuideAngleLine(gizmoPos, this._selectedAxis,
                this._guideAngleStart, this._guideAngleStartColor);
            this._drawGuideAngleLine(gizmoPos, this._selectedAxis, this._guideAngleEnd);
        }
    }
}

export { RotateGizmo };
