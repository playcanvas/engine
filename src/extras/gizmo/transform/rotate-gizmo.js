import { Debug } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import { Color } from '../../../core/math/color.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec2 } from '../../../core/math/vec2.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { PROJECTION_PERSPECTIVE } from '../../../scene/constants.js';

import { ArcShape } from '../shape/arc-shape.js';
import { TransformGizmo } from './transform-gizmo.js';
import { MeshLine } from '../mesh/mesh-line.js';
import { MeshSector } from '../mesh/mesh-sector.js';
import { SphereShape } from '../shape/sphere-shape.js';

/**
 * @import { CameraComponent } from '../../../framework/components/camera/component.js'
 * @import { GraphNode } from '../../../scene/graph-node.js'
 * @import { Layer } from '../../../scene/layer.js'
 * @import { GizmoAxis } from '../constants.js'
 */

const point = new Vec3();
const v1 = new Vec3();
const v2 = new Vec3();
const v3 = new Vec3();
const q1 = new Quat();
const q2 = new Quat();
const color = new Color();

const RING_FACING_EPSILON = 1e-4;
const SECTOR_ALPHA = 0.4;
const UPDATE_EPSILON = 1e-6;
const AXES = /** @type {('x' | 'y' | 'z')[]} */ (['x', 'y', 'z']);

/**
 * Rotates the attached {@link Entity}s with a ring for each axis, plus a ring in the camera's view
 * plane. Works with mouse, keyboard and touch input.
 *
 * ```javascript
 * const gizmoLayer = Gizmo.createLayer(app);
 * const gizmo = new RotateGizmo(cameraComponent, gizmoLayer);
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
     * The angle at the start of a drag.
     *
     * @private
     */
    _selectionStartAngle = 0;

    /**
     * The local rotation of each node at the start of a drag.
     *
     * @type {Map<GraphNode, Quat>}
     * @private
     */
    _nodeLocalRotations = new Map();

    /**
     * The world rotation of each node at the start of a drag.
     *
     * @type {Map<GraphNode, Quat>}
     * @private
     */
    _nodeRotations = new Map();

    /**
     * The offset of each node from the gizmo at the start of a drag.
     *
     * @type {Map<GraphNode, Vec3>}
     * @private
     */
    _nodeOffsets = new Map();

    /**
     * The pointer position on screen.
     *
     * @private
     */
    _screenPos = new Vec2();

    /**
     * The pointer position on screen at the start of a drag.
     *
     * @private
     */
    _screenStartPos = new Vec2();

    /**
     * The start point of the angle guide.
     *
     * @private
     */
    _guideAngleStart = new Vec3();

    /**
     * The end point of the angle guide.
     *
     * @private
     */
    _guideAngleEnd = new Vec3();

    /**
     * The angle guide lines.
     *
     * @type {[MeshLine, MeshLine]}
     * @private
     */
    _guideAngleLines;

    /**
     * The sectors filling the swept angle and, past a full turn, the rest of the circle.
     *
     * @type {MeshSector[]}
     * @private
     */
    _guideAngleSectors;

    /**
     * The world axis the angle guide sweeps around.
     *
     * @private
     */
    _guideAngleAxis = new Vec3();

    /**
     * The swept angle in degrees.
     *
     * @private
     */
    _guideAngle = 0;

    /**
     * The last facing direction, to skip unneeded updates.
     *
     * @private
     */
    _facingDir = new Vec3();

    /**
     * The rotation mode: 'absolute' rotates by the pointer movement from the initial click, and
     * 'orbit' by the pointer's angle around the gizmo. Defaults to 'absolute'.
     *
     * @type {'absolute' | 'orbit'}
     */
    rotationMode = 'absolute';

    /**
     * Creates a new RotateGizmo object. Use {@link Gizmo.createLayer} to create its layer.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The render layer.
     * @example
     * const gizmo = new RotateGizmo(camera, layer);
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

        this._guideAngleSectors = [
            new MeshSector(this._app, this._layer),
            new MeshSector(this._app, this._layer)
        ];
        this._guideAngleSectors.forEach((sector) => {
            this._app.root.addChild(sector.entity);
            sector.entity.enabled = false;
        });

        this.on(TransformGizmo.EVENT_TRANSFORMSTART, (point, x, y) => {
            this._screenPos.set(x, y);
            this._screenStartPos.set(x, y);

            this._selectionStartAngle = this._calculateArcAngle(point, x, y);

            this._storeNodeRotations();

            this._storeGuidePoints();

            this._drag(true);

            this._angleGuide(true);

            this.fire(TransformGizmo.EVENT_TRANSFORMREADOUT, this._selectedAxis, this._selectedIsPlane, 0);
        });

        this.on(TransformGizmo.EVENT_TRANSFORMMOVE, (point, x, y) => {
            const axis = this._selectedAxis;
            if (!axis) {
                return;
            }

            this._screenPos.set(x, y);

            if (axis === 'xyz') {
                const facingDir = v1.copy(this.facingDir);
                const delta = v2.copy(point).sub(this._selectionStartPoint);
                const angleAxis = v1.cross(facingDir, delta).normalize();
                const angleDelta = this._screenPos.distance(this._screenStartPos);
                this._setNodeRotations(axis, angleAxis, angleDelta);

                this.fire(TransformGizmo.EVENT_TRANSFORMREADOUT, this._selectedAxis, this._selectedIsPlane, angleDelta);
            } else {
                let angleDelta = this._calculateArcAngle(point, x, y) - this._selectionStartAngle;

                angleDelta = this._snapAngle(angleDelta);
                const angleAxis = this._dirFromAxis(axis, v1);
                this._setNodeRotations(axis, angleAxis, angleDelta);

                this._updateGuidePoints(angleDelta);
                this._angleGuide(true);

                this.fire(TransformGizmo.EVENT_TRANSFORMREADOUT, this._selectedAxis, this._selectedIsPlane, angleDelta);
            }
        });

        this.on(TransformGizmo.EVENT_TRANSFORMREADOUT, (_axis, _isPlane, angle) => {
            if (!this._readout) {
                return;
            }
            this._showAngleReadout(angle);
        });

        this.on(TransformGizmo.EVENT_TRANSFORMEND, () => {
            this._drag(false);

            this._angleGuide(false);
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
     * Sets the gizmo render layer.
     *
     * @type {Layer}
     */
    set layer(layer) {
        super.layer = layer;

        // the guide lines are not children of the gizmo root
        const ids = [layer.id];
        for (let i = 0; i < this._guideAngleLines.length; i++) {
            const { render } = this._guideAngleLines[i].entity;
            if (render) {
                render.layers = ids;
            }
        }
    }

    /**
     * Gets the gizmo render layer.
     *
     * @type {Layer}
     */
    get layer() {
        return super.layer;
    }

    /**
     * @type {boolean}
     * @deprecated Use {@link rotationMode} instead.
     * @ignore
     */
    set orbitRotation(value) {
        this.rotationMode = value ? 'orbit' : 'absolute';
    }

    /**
     * @type {boolean}
     * @deprecated Use {@link rotationMode} instead.
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
     * Shows the angle in the readout, below a sphere around the rings since the rings turn while
     * dragging.
     *
     * @param {number} angle - The angle in degrees.
     * @private
     */
    _showAngleReadout(angle) {
        const axis = this._selectedAxis;
        const label = axis === 'f' || axis === 'xyz' ? '' : `${this._readoutLabel(axis)} `;
        const html = `${label}${this._readoutDelta(angle, 1)}°`;
        const radius = this._scale *
            Math.max(this.xyzRingRadius + this.xyzTubeRadius, this.faceRingRadius + this.faceTubeRadius);

        const center = this.root.getPosition();
        const x = this._camera.worldToScreen(center, v3).x;

        // in perspective the lowest point of the outline is where a camera ray grazes the sphere
        const up = this._camera.entity.up;
        const eye = this._camera.entity.getPosition();
        const view = v1.sub2(center, eye);
        const dist = view.length();
        if (this._camera.projection !== PROJECTION_PERSPECTIVE || dist <= radius) {
            v3.copy(up).mulScalar(-radius).add(center);
            this._readout?.show(html, x, this._camera.worldToScreen(v3, point).y);
            return;
        }
        view.mulScalar(1 / dist);
        const down = v2.copy(view).mulScalar(up.dot(view)).sub(up).normalize();
        const sin = radius / dist;
        const cos = Math.sqrt(1 - sin * sin);
        v3.copy(view).mulScalar(cos).add(down.mulScalar(sin)).mulScalar(dist * cos).add(eye);
        this._readout?.show(html, x, this._camera.worldToScreen(v3, point).y);
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
        this._guideAngle = 0;
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
        this._guideAngleAxis.copy(v1);
        this._guideAngle = angleDelta;

        this._renderUpdate = true;
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

            // each full turn adds opacity to the whole circle, the swept part one step more
            const angle = this._guideAngle;
            const turns = Math.floor(Math.abs(angle) / 360);
            const swept = angle % 360;
            const rest = swept >= 0 ? 360 - swept : -(360 + swept);
            color.copy(this._theme.shapeBase[axis]);
            color.a = Math.min(1, SECTOR_ALPHA * (turns + 1));
            this._guideAngleSectors[0].draw(gizmoPos, this._guideAngleStart, this._guideAngleAxis, 0, swept,
                this._scale, color);
            this._guideAngleSectors[0].entity.enabled = swept !== 0;
            if (turns > 0) {
                color.a = Math.min(1, SECTOR_ALPHA * turns);
                this._guideAngleSectors[1].draw(gizmoPos, this._guideAngleStart, this._guideAngleAxis, swept, rest,
                    this._scale, color);
            }
            this._guideAngleSectors[1].entity.enabled = turns > 0;
        } else {
            this._guideAngleLines[0].entity.enabled = false;
            this._guideAngleLines[1].entity.enabled = false;
            this._guideAngleSectors[0].entity.enabled = false;
            this._guideAngleSectors[1].entity.enabled = false;
        }
    }

    /**
     * @private
     */
    _shapesLookAtCamera() {
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

        let angle, dot, sector;
        const facingDir = v1.copy(this.facingDir);
        q1.copy(this.root.getRotation()).invert().transformVector(facingDir, facingDir);
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
        }

        if (!facingDir.equalsApprox(this._facingDir, UPDATE_EPSILON)) {
            this._facingDir.copy(facingDir);
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

        this._renderUpdate = true;
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
            // retry with the ray reversed
            ray.direction.mulScalar(-1);
            const intersection = plane.intersectsRay(ray, point);
            ray.direction.mulScalar(-1);

            if (!intersection) {
                // fall back to the gizmo position so the angle guide stays put
                return point.copy(this.root.getLocalPosition());
            }
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

        const facingDir = this.facingDir;
        const facingDot = plane.normal.dot(facingDir);

        switch (this.rotationMode) {
            case 'absolute': {
                this._camera.worldToScreen(gizmoPos, v2);
                if (axis === 'f' || facingDot > 1 - RING_FACING_EPSILON) {
                    // flip the direction by which side of the ring the pointer is on
                    v1.set(
                        this._screenStartPos.y >= v2.y ? 1 : -1,
                        this._screenStartPos.x >= v2.x ? -1 : 1,
                        0
                    ).normalize();
                } else {
                    const projDir = v1.cross(plane.normal, facingDir).normalize();

                    this._camera.worldToScreen(projDir.add(gizmoPos), v3);
                    v1.sub2(v3, v2).normalize();
                }

                v2.set(x, y, 0);
                angle = v1.dot(v2);
                break;
            }
            case 'orbit': {
                // the angle of the point around the gizmo
                v1.sub2(point, gizmoPos);

                switch (axis) {
                    case 'x': {
                        q1.copy(this._rootStartRot).invert().transformVector(v1, v1);
                        angle = Math.atan2(v1.z, v1.y) * math.RAD_TO_DEG;
                        break;
                    }
                    case 'y': {
                        q1.copy(this._rootStartRot).invert().transformVector(v1, v1);
                        angle = Math.atan2(v1.x, v1.z) * math.RAD_TO_DEG;
                        break;
                    }
                    case 'z': {
                        q1.copy(this._rootStartRot).invert().transformVector(v1, v1);
                        angle = Math.atan2(v1.y, v1.x) * math.RAD_TO_DEG;
                        break;
                    }
                    case 'f': {
                        q1.copy(this._camera.entity.getRotation()).invert().transformVector(v1, v1);
                        angle = Math.sign(facingDot) * Math.atan2(v1.y, v1.x) * math.RAD_TO_DEG;
                        break;
                    }
                }

                // flip the angle for an intersection behind the camera
                const dir = v1.sub2(point, this._camera.entity.getPosition()).normalize();
                const dot = dir.dot(this._camera.entity.forward);
                if (dot < 0) {
                    angle += 180;
                }

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
        this._guideAngleSectors.forEach(sector => sector.destroy());

        super.destroy();
    }

    // ---- deprecated block start ----

    /**
     * @type {number}
     * @deprecated Use {@link RotateGizmo#snapAngleIncrement} instead.
     * @ignore
     */
    set snapIncrement(value) {
        Debug.deprecated('RotateGizmo#snapIncrement is deprecated. Use RotateGizmo#snapAngleIncrement instead.');
        this.snapAngleIncrement = value;
    }

    /**
     * @type {number}
     * @deprecated Use {@link RotateGizmo#snapAngleIncrement} instead.
     * @ignore
     */
    get snapIncrement() {
        Debug.deprecated('RotateGizmo#snapIncrement is deprecated. Use RotateGizmo#snapAngleIncrement instead.');
        return this.snapAngleIncrement;
    }

    // ---- deprecated block end ----
}

export { RotateGizmo };
