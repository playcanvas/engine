import { math } from '../../core/math/math.js';
import { Color } from '../../core/math/color.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { PROJECTION_PERSPECTIVE } from '../../scene/constants.js';

import { ArcShape } from './shape/arc-shape.js';
import { TransformGizmo } from './transform-gizmo.js';
import { MeshLine } from './mesh-line.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { GraphNode } from '../../scene/graph-node.js'
 * @import { Layer } from '../../scene/layer.js'
 * @import { GizmoAxis } from './constants.js'
 */

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();
const tmpV4 = new Vec3();
const tmpQ1 = new Quat();
const tmpQ2 = new Quat();
const tmpC1 = new Color();

// constants
const ROTATE_FACING_EPSILON = 0.1;
const RING_FACING_EPSILON = 1e-4;

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
            axis: 'z',
            layers: [this._layer.id],
            rotation: new Vec3(90, 0, 90),
            defaultColor: this._theme.shapeBase.z,
            hoverColor: this._theme.shapeHover.z,
            disabledColor: this._theme.disabled,
            sectorAngle: 180
        }),
        x: new ArcShape(this._device, {
            axis: 'x',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._theme.shapeBase.x,
            hoverColor: this._theme.shapeHover.x,
            disabledColor: this._theme.disabled,
            sectorAngle: 180
        }),
        y: new ArcShape(this._device, {
            axis: 'y',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._theme.shapeBase.y,
            hoverColor: this._theme.shapeHover.y,
            disabledColor: this._theme.disabled,
            sectorAngle: 180
        }),
        f: new ArcShape(this._device, {
            axis: 'f',
            layers: [this._layer.id],
            defaultColor: this._theme.shapeBase.f,
            hoverColor: this._theme.shapeHover.f,
            disabledColor: this._theme.disabled,
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
     * Internal mesh lines for guide angles.
     *
     * @type {[MeshLine, MeshLine]}
     * @private
     */
    _guideAngleLines;

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
        super(camera, layer, 'gizmo:rotate');

        this._createTransform();

        this._guideAngleLines = [
            new MeshLine(this._app, this._layer),
            new MeshLine(this._app, this._layer)
        ];
        this._guideAngleLines.forEach((line) => {
            this._app.root.addChild(line.entity);
            line.entity.enabled = false;
        });

        this.on(TransformGizmo.EVENT_TRANSFORMSTART, (point, x, y) => {
            // store start angle
            this._selectionStartAngle = this._calculateArcAngle(point, x, y);

            // store initial node rotations
            this._storeNodeRotations();

            // store guide points
            this._storeGuidePoints();

            // drag handle for disk (arc <-> circle)
            this._drag(true);

            // angle guide lines
            this._angleGuide(true);
        });

        this.on(TransformGizmo.EVENT_TRANSFORMMOVE, (point, x, y) => {
            const axis = this._selectedAxis;
            if (!axis) {
                return;
            }

            // calculate angle axis and delta and update node rotations
            let angleDelta = this._calculateArcAngle(point, x, y) - this._selectionStartAngle;
            if (this.snap) {
                angleDelta = Math.round(angleDelta / this.snapIncrement) * this.snapIncrement;
            }
            const angleAxis = this._dirFromAxis(axis, tmpV1);
            this._setNodeRotations(axis, angleAxis, angleDelta);

            // update guide points and show angle guide
            this._updateGuidePoints(angleDelta);
            this._angleGuide(true);

        });

        this.on(TransformGizmo.EVENT_TRANSFORMEND, () => {
            // show all shapes
            this._drag(false);

            // hide angle guide
            this._angleGuide(false);
        });

        this.on(TransformGizmo.EVENT_NODESDETACH, () => {
            // reset stored rotations and offsets
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
        this._shapes.f.tubeRadius = value;
    }

    /**
     * Gets the face tube radius.
     *
     * @type {number}
     */
    get faceTubeRadius() {
        return this._shapes.f.tubeRadius;
    }

    /**
     * Sets the face ring radius.
     *
     * @type {number}
     */
    set faceRingRadius(value) {
        this._shapes.f.ringRadius = value;
    }

    /**
     * Gets the face ring radius.
     *
     * @type {number}
     */
    get faceRingRadius() {
        return this._shapes.f.ringRadius;
    }

    /**
     * Sets the ring tolerance.
     *
     * @type {number}
     */
    set ringTolerance(value) {
        this._setDiskProp('tolerance', value);
        this._shapes.f.tolerance = value;
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
     * Sets the angle guide line thickness.
     *
     * @type {number}
     */
    set angleGuideThickness(value) {
        this._guideAngleLines[0].thickness = value;
        this._guideAngleLines[1].thickness = value;
    }

    /**
     * Gets the angle guide line thickness.
     *
     * @type {number}
     */
    get angleGuideThickness() {
        return this._guideAngleLines[0].thickness;
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
        const gizmoPos = this.root.getLocalPosition();
        const axis = this._selectedAxis;
        const isFacing = axis === 'f';
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
        const isFacing = axis === 'f';

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
     * @param {boolean} state - The state.
     * @private
     */
    _angleGuide(state) {
        const axis = this._selectedAxis;

        if (state && this.dragMode !== 'show' && axis !== 'xyz') {
            const gizmoPos = this.root.getLocalPosition();
            const color = this._theme.guideBase[axis];
            const startColor = tmpC1.copy(color);
            startColor.a *= 0.3;
            this._guideAngleLines[0].draw(gizmoPos, tmpV1.copy(this._guideAngleStart).add(gizmoPos),
                this._scale, startColor);
            this._guideAngleLines[1].draw(gizmoPos, tmpV1.copy(this._guideAngleEnd).add(gizmoPos),
                this._scale, color);
            this._guideAngleLines[0].entity.enabled = true;
            this._guideAngleLines[1].entity.enabled = true;
        } else {
            this._guideAngleLines[0].entity.enabled = false;
            this._guideAngleLines[1].entity.enabled = false;
        }
    }

    /**
     * @private
     */
    _shapesLookAtCamera() {
        // face shape
        if (this._camera.projection === PROJECTION_PERSPECTIVE) {
            const dir = this._camera.entity.getPosition().sub(this.root.getPosition()).normalize();
            const elev = Math.atan2(-dir.y, Math.sqrt(dir.x * dir.x + dir.z * dir.z)) * math.RAD_TO_DEG;
            const azim = Math.atan2(-dir.x, -dir.z) * math.RAD_TO_DEG;
            this._shapes.f.entity.setEulerAngles(-elev + 90, azim, 0);
        } else {
            tmpQ1.copy(this._camera.entity.getRotation()).getEulerAngles(tmpV1);
            this._shapes.f.entity.setEulerAngles(tmpV1);
            this._shapes.f.entity.rotateLocal(-90, 0, 0);
        }

        // axes shapes
        let angle, dot, sector;
        const facingDir = tmpV1.copy(this.facingDir);
        tmpQ1.copy(this.root.getRotation()).invert().transformVector(facingDir, facingDir);
        angle = Math.atan2(facingDir.z, facingDir.y) * math.RAD_TO_DEG;
        this._shapes.x.entity.setLocalEulerAngles(0, angle - 90, -90);
        angle = Math.atan2(facingDir.x, facingDir.z) * math.RAD_TO_DEG;
        this._shapes.y.entity.setLocalEulerAngles(0, angle, 0);
        angle = Math.atan2(facingDir.y, facingDir.x) * math.RAD_TO_DEG;
        this._shapes.z.entity.setLocalEulerAngles(90, 0, angle + 90);

        if (!this._dragging) {
            dot = facingDir.dot(this.root.right);
            sector = 1 - Math.abs(dot) > RING_FACING_EPSILON;
            this._shapes.x.show(sector ? 'sector' : 'ring');
            dot = facingDir.dot(this.root.up);
            sector = 1 - Math.abs(dot) > RING_FACING_EPSILON;
            this._shapes.y.show(sector ? 'sector' : 'ring');
            dot = facingDir.dot(this.root.forward);
            sector = 1 - Math.abs(dot) > RING_FACING_EPSILON;
            this._shapes.z.show(sector ? 'sector' : 'ring');

            this.fire(TransformGizmo.EVENT_RENDERUPDATE);
        }
    }

    /**
     * @param {boolean} state - The state.
     * @private
     */
    _drag(state) {
        for (const axis in this._shapes) {
            const shape = this._shapes[axis];
            if (!(shape instanceof ArcShape)) {
                continue;
            }
            switch (this.dragMode) {
                case 'show': {
                    break;
                }
                case 'hide': {
                    shape.show(state ? axis === this._selectedAxis ? 'ring' : 'none' : 'sector');
                    continue;
                }
                case 'selected': {
                    shape.show(state ? axis === this._selectedAxis ? 'ring' : 'sector' : 'sector');
                    break;
                }
            }
        }
        this.fire(TransformGizmo.EVENT_RENDERUPDATE);
    }

    /**
     * @private
     */
    _storeNodeRotations() {
        const gizmoPos = this.root.getLocalPosition();
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            this._nodeLocalRotations.set(node, node.getLocalRotation().clone());
            this._nodeRotations.set(node, node.getRotation().clone());
            this._nodeOffsets.set(node, node.getPosition().clone().sub(gizmoPos));
        }
    }

    /**
     * @param {GizmoAxis} axis - The axis.
     * @param {Vec3} angleAxis - The angle axis.
     * @param {number} angleDelta - The angle delta.
     * @private
     */
    _setNodeRotations(axis, angleAxis, angleDelta) {
        const gizmoPos = this.root.getLocalPosition();

        // calculate rotation from axis and angle
        tmpQ1.setFromAxisAngle(angleAxis, angleDelta);

        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];

            if ((axis === 'x' || axis === 'y' || axis === 'z') && this._coordSpace === 'local') {
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

                // FIXME: Rotation via quaternion when scale inverted causes scale warping?
                node.setEulerAngles(tmpQ2.getEulerAngles());
                node.setPosition(tmpV1.add(gizmoPos));
            }
        }

        if (this._coordSpace === 'local') {
            this._updateRotation();
        }
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

        const point = new Vec3();
        const ray = this._createRay(mouseWPos);
        const plane = this._createPlane(axis, axis === 'f', false);
        if (!plane.intersectsRay(ray, point)) {
            point.copy(this.root.getLocalPosition());
        }

        return point;
    }

    /**
     * @param {Vec3} point - The point.
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @returns {number} The angle.
     * @protected
     */
    _calculateArcAngle(point, x, y) {
        const gizmoPos = this.root.getLocalPosition();

        const axis = this._selectedAxis;

        const plane = this._createPlane(axis, axis === 'f', false);

        let angle = 0;

        // arc angle
        const facingDir = tmpV2.copy(this.facingDir);
        const facingDot = plane.normal.dot(facingDir);
        if (this.orbitRotation || (1 - Math.abs(facingDot)) < ROTATE_FACING_EPSILON) {
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

        if (!this.enabled) {
            return;
        }

        this._shapesLookAtCamera();
    }
}

export { RotateGizmo };
