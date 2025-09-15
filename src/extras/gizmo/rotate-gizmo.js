import { math } from '../../core/math/math.js';
import { Color } from '../../core/math/color.js';
import { Quat } from '../../core/math/quat.js';
import { Vec2 } from '../../core/math/vec2.js';
import { Vec3 } from '../../core/math/vec3.js';
import { PROJECTION_PERSPECTIVE } from '../../scene/constants.js';

import { ArcShape } from './shape/arc-shape.js';
import { TransformGizmo } from './transform-gizmo.js';
import { MeshLine } from './mesh-line.js';
import { SphereShape } from './shape/sphere-shape.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { GraphNode } from '../../scene/graph-node.js'
 * @import { Layer } from '../../scene/layer.js'
 * @import { GizmoAxis } from './constants.js'
 */

// temporary variables
const screen = new Vec2();
const point = new Vec3();
const v1 = new Vec3();
const v2 = new Vec3();
const v3 = new Vec3();
const q1 = new Quat();
const q2 = new Quat();
const color = new Color();

// constants
const RING_FACING_EPSILON = 1e-4;
const AXES = /** @type {('x' | 'y' | 'z')[]} */ (['x', 'y', 'z']);

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
        }),
        xyz: new SphereShape(this._device, {
            axis: 'xyz',
            layers: [this._layer.id],
            defaultColor: this._theme.shapeBase.xyz,
            hoverColor: this._theme.shapeHover.xyz,
            disabledColor: this._theme.disabled,
            radius: 0.5
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
     * Internal vector for storing the mouse position in screen space.
     *
     * @type {Vec2}
     * @private
     */
    _screenPos = new Vec2();

    /**
     * Internal vector for storing the mouse start position in screen space.
     *
     * @type {Vec2}
     * @private
     */
    _screenStartPos = new Vec2();

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
     * The rotation mode of the gizmo. This can be either:
     *
     * - 'absolute': The rotation is calculated based on the mouse displacement relative to the
     * initial click point.
     * - 'orbit': The rotation is calculated based on the gizmos position around the center of
     * rotation.
     *
     * @type {'absolute' | 'orbit'}
     */
    rotationMode = 'absolute';

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

        this.setTheme({
            shapeBase: {
                xyz: new Color(0, 0, 0, 0)
            },
            shapeHover: {
                xyz: new Color(1, 1, 1, 0.2)
            }
        });

        this._createTransform();

        this._guideAngleLines = [
            new MeshLine(this._app, this._layer),
            new MeshLine(this._app, this._layer)
        ];
        this._guideAngleLines.forEach((line) => {
            this._app.root.addChild(line.entity);
            line.entity.enabled = false;
        });

        this.on(TransformGizmo.EVENT_TRANSFORMSTART, (_point, x, y) => {
            // store start screen point
            this._screenPos.set(x, y);
            this._screenStartPos.set(x, y);

            // store start angle
            this._selectionStartAngle = this._calculateArcAngle(x, y);

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

            // update screen point
            this._screenPos.set(x, y);

            if (axis === 'xyz') {
                // calculate angle axis and delta and update node rotations
                const facingDir = v1.copy(this.facingDir);
                const delta = v2.copy(point).sub(this._selectionStartPoint);
                const angleAxis = v1.cross(facingDir, delta).normalize();
                const angleDelta = this._screenPos.distance(this._screenStartPos);
                this._setNodeRotations(axis, angleAxis, angleDelta);
            } else {
                // calculate angle axis and delta and update node rotations
                let angleDelta = this._calculateArcAngle(x, y) - this._selectionStartAngle;
                if (this.snap) {
                    angleDelta = Math.round(angleDelta / this.snapIncrement) * this.snapIncrement;
                }
                const angleAxis = this._dirFromAxis(axis, v1);
                this._setNodeRotations(axis, angleAxis, angleDelta);

                // update guide points and show angle guide
                this._updateGuidePoints(angleDelta);
                this._angleGuide(true);
            }
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
     * Sets the center radius.
     *
     * @type {number}
     */
    set centerRadius(value) {
        this._shapes.xyz.radius = value;
    }

    /**
     * Gets the center radius.
     *
     * @type {number}
     */
    get centerRadius() {
        return this._shapes.xyz.radius;
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
     * @type {boolean}
     * @deprecated Use {@link RotationGizmo#rotationMode} instead.
     * @ignore
     */
    set orbitRotation(value) {
        this.rotationMode = value ? 'orbit' : 'absolute';
    }

    /**
     * @type {boolean}
     * @deprecated Use {@link RotationGizmo#rotationMode} instead.
     * @ignore
     */
    get orbitRotation() {
        return this.rotationMode === 'orbit';
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
            v1.copy(this.facingDir);
        } else {
            v1.set(0, 0, 0);
            v1[axis] = 1;
            this._rootStartRot.transformVector(v1, v1);
        }
        q1.setFromAxisAngle(v1, angleDelta);
        q1.transformVector(this._guideAngleStart, this._guideAngleEnd);
    }

    /**
     * @param {boolean} state - The state.
     * @private
     */
    _angleGuide(state) {
        const axis = this._selectedAxis;

        if (state && this.dragMode !== 'show' && axis !== 'xyz') {
            const gizmoPos = this.root.getLocalPosition();
            const baseColor = this._theme.shapeHover[axis];
            const startColor = color.copy(baseColor);
            startColor.a *= 0.3;
            this._guideAngleLines[0].draw(gizmoPos, v1.copy(this._guideAngleStart).add(gizmoPos),
                this._scale, startColor);
            this._guideAngleLines[1].draw(gizmoPos, v1.copy(this._guideAngleEnd).add(gizmoPos),
                this._scale, baseColor);
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
            q1.copy(this._camera.entity.getRotation()).getEulerAngles(v1);
            this._shapes.f.entity.setEulerAngles(v1);
            this._shapes.f.entity.rotateLocal(-90, 0, 0);
        }

        // axes shapes
        let angle, dot, sector;
        const facingDir = v1.copy(this.facingDir);
        q1.copy(this.root.getLocalRotation()).invert().transformVector(facingDir, facingDir);
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
        q1.setFromAxisAngle(angleAxis, angleDelta);

        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];

            if ((axis === 'x' || axis === 'y' || axis === 'z') && this._coordSpace === 'local') {
                const rot = this._nodeLocalRotations.get(node);
                if (!rot) {
                    continue;
                }
                q2.copy(rot).mul(q1);
                node.setLocalRotation(q2);
            } else {
                const rot = this._nodeRotations.get(node);
                if (!rot) {
                    continue;
                }
                const offset = this._nodeOffsets.get(node);
                if (!offset) {
                    continue;
                }
                v1.copy(offset);
                q1.transformVector(v1, v1);
                q2.copy(q1).mul(rot);
                node.setRotation(q2);
                node.setPosition(v1.add(gizmoPos));
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

        const ray = this._createRay(mouseWPos);
        const plane = this._createPlane(axis, axis === 'f' || axis === 'xyz', false);
        if (!plane.intersectsRay(ray, point)) {
            return point;
        }

        return point;
    }

    /**
     * @param {number} x - The x coordinate.
     * @param {number} y - The y coordinate.
     * @returns {number} The angle.
     * @protected
     */
    _calculateArcAngle(x, y) {
        const gizmoPos = this.root.getLocalPosition();

        const axis = this._selectedAxis;

        const plane = this._createPlane(axis, axis === 'f', false);

        let angle = 0;

        // arc angle
        const facingDir = this.facingDir;
        const facingDot = plane.normal.dot(facingDir);

        switch (this.rotationMode) {
            case 'absolute': {
                this._camera.worldToScreen(gizmoPos, v2);
                if (axis === 'f' || facingDot > 1 - RING_FACING_EPSILON) {
                    // determine which size of the ring the mouse is on to flip rotation direction
                    v1.set(
                        this._screenStartPos.y >= v2.y ? 1 : -1,
                        this._screenStartPos.x >= v2.x ? -1 : 1,
                        0
                    ).normalize();
                } else {
                    // calculate projection vector in world space for rotation axis
                    const projDir = v1.cross(plane.normal, facingDir).normalize();

                    // convert to screen space
                    this._camera.worldToScreen(projDir.add(gizmoPos), v3);
                    v1.sub2(v3, v2).normalize();
                }

                // angle is dot product with mouse position
                v2.set(x, y, 0);
                angle = v1.dot(v2);
                break;
            }
            case 'orbit': {
                // convert gizmo position to screen space§
                const screenPos = this._camera.worldToScreen(gizmoPos, v1);

                // calculate angle based on mouse position around gizmo
                const dir = screen.set(x - screenPos.x, y - screenPos.y).normalize();
                angle = Math.sign(facingDot) * Math.atan2(-dir.y, dir.x) * math.RAD_TO_DEG;
                break;
            }
        }
        return angle;
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
            if (activeAxis === 'xyz') {
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

    /**
     * @override
     */
    destroy() {
        this._guideAngleLines.forEach(line => line.destroy());

        super.destroy();
    }
}

export { RotateGizmo };
