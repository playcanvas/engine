import { math } from '../../core/math/math.js';
import { Color } from '../../core/math/color.js';
import { Quat } from '../../core/math/quat.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Vec3 } from '../../core/math/vec3.js';
import { PROJECTION_PERSPECTIVE } from '../../scene/constants.js';

import { AxisDisk } from './axis-shapes.js';
import { GIZMO_LOCAL } from './gizmo.js';
import { TransformGizmo } from "./transform-gizmo.js";

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpM1 = new Mat4();
const tmpQ1 = new Quat();
const tmpQ2 = new Quat();

/**
 * Rotation gizmo.
 *
 * @category Gizmo
 */
class RotateGizmo extends TransformGizmo {
    _shapes = {
        z: new AxisDisk(this._device, {
            axis: 'z',
            layers: [this._layer.id],
            rotation: new Vec3(90, 0, 90),
            defaultColor: this._meshColors.axis.z,
            hoverColor: this._meshColors.hover.z,
            sectorAngle: 180
        }),
        x: new AxisDisk(this._device, {
            axis: 'x',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._meshColors.axis.x,
            hoverColor: this._meshColors.hover.x,
            sectorAngle: 180
        }),
        y: new AxisDisk(this._device, {
            axis: 'y',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._meshColors.axis.y,
            hoverColor: this._meshColors.hover.y,
            sectorAngle: 180
        }),
        face: new AxisDisk(this._device, {
            axis: 'face',
            layers: [this._layer.id],
            rotation: this._getLookAtEulerAngles(this._camera.entity.getPosition()),
            defaultColor: this._meshColors.axis.face,
            hoverColor: this._meshColors.hover.face,
            ringRadius: 0.55
        })
    };

    _isRotation = true;

    /**
     * Internal mapping from each attached node to their starting rotation in local space.
     *
     * @type {Map<import('../../scene/graph-node.js').GraphNode, Quat>}
     * @private
     */
    _nodeLocalRotations = new Map();

    /**
     * Internal mapping from each attached node to their starting rotation in world space.
     *
     * @type {Map<import('../../scene/graph-node.js').GraphNode, Quat>}
     * @private
     */
    _nodeRotations = new Map();

    /**
     * Internal mapping from each attached node to their offset position from the gizmo.
     *
     * @type {Map<import('../../scene/graph-node.js').GraphNode, Vec3>}
     * @private
     */
    _nodeOffsets = new Map();

    /**
     * Internal color for guide angle starting line.
     *
     * @type {Color}
     * @private
     */
    _guideAngleStartColor = new Color(0, 0, 0, 0.3);

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
     * Creates a new RotateGizmo object.
     *
     * @param {import('../../framework/app-base.js').AppBase} app - The application instance.
     * @param {import('../../framework/components/camera/component.js').CameraComponent} camera -
     * The camera component.
     * @param {import('../../scene/layer.js').Layer} layer - The render layer.
     * @example
     * const gizmo = new pcx.RotateGizmo(app, camera, layer);
     */
    constructor(app, camera, layer) {
        super(app, camera, layer);

        this._createTransform();

        this.on('transform:start', () => {
            const axis = this._selectedAxis;
            const isFacing = axis === 'face';
            const scale = isFacing ? this.faceRingRadius : this.xyzRingRadius;

            this._storeNodeRotations();

            // guide angle line start
            this._guideAngleStart.copy(this._selectionStartPoint).normalize();
            this._guideAngleStart.mulScalar(scale);
            this._gizmoRotationStart.transformVector(this._guideAngleStart, this._guideAngleStart);
            this._guideAngleEnd.copy(this._guideAngleStart);

            // drag handle for disk (arc <-> circle)
            this._drag(true);
        });

        this.on('transform:move', (pointDelta, angleDelta) => {
            const gizmoPos = this.root.getPosition();
            const cameraPos = this._camera.entity.getPosition();
            const axis = this._selectedAxis;
            const isFacing = axis === 'face';

            if (this.snap) {
                angleDelta = Math.round(angleDelta / this.snapIncrement) * this.snapIncrement;
            }
            this._setNodeRotations(axis, angleDelta);

            // guide angle line update rotation
            tmpV1.set(0, 0, 0);
            if (isFacing) {
                tmpV1.copy(cameraPos).sub(gizmoPos).normalize();
            } else {
                tmpV1[axis] = 1;
            }
            this._gizmoRotationStart.transformVector(tmpV1, tmpV1);
            tmpQ1.setFromAxisAngle(tmpV1, angleDelta);
            tmpQ1.transformVector(this._guideAngleStart, this._guideAngleEnd);
        });

        this.on('transform:end', () => {
            this._drag(false);
        });

        this.on('nodes:detach', () => {
            this._nodeLocalRotations.clear();
            this._nodeRotations.clear();
            this._nodeOffsets.clear();
        });

        app.on('update', () => {
            this._faceAxisLookAtCamera();
            this._xyzAxisLookAtCamera();

            if (this._dragging) {
                const gizmoPos = this.root.getPosition();
                this._drawGuideAngleLine(gizmoPos, this._selectedAxis,
                                         this._guideAngleStart, this._guideAngleStartColor);
                this._drawGuideAngleLine(gizmoPos, this._selectedAxis, this._guideAngleEnd);
            }
        });
    }

    /**
     * XYZ tube radius.
     *
     * @type {number}
     */
    set xyzTubeRadius(value) {
        this._setDiskProp('tubeRadius', value);
    }

    get xyzTubeRadius() {
        return this._shapes.x.tubeRadius;
    }

    /**
     * XYZ ring radius.
     *
     * @type {number}
     */
    set xyzRingRadius(value) {
        this._setDiskProp('ringRadius', value);
    }

    get xyzRingRadius() {
        return this._shapes.x.ringRadius;
    }

    /**
     * Face tube radius.
     *
     * @type {number}
     */
    set faceTubeRadius(value) {
        this._shapes.face.tubeRadius = value;
    }

    get faceTubeRadius() {
        return this._shapes.face.tubeRadius;
    }

    /**
     * Face ring radius.
     *
     * @type {number}
     */
    set faceRingRadius(value) {
        this._shapes.face.ringRadius = value;
    }

    get faceRingRadius() {
        return this._shapes.face.ringRadius;
    }

    /**
     * Ring tolerance.
     *
     * @type {number}
     */
    set ringTolerance(value) {
        this._setDiskProp('tolerance', value);
        this._shapes.face.tolerance = value;
    }

    get ringTolerance() {
        return this._shapes.x.tolerance;
    }

    _setDiskProp(prop, value) {
        this._shapes.x[prop] = value;
        this._shapes.y[prop] = value;
        this._shapes.z[prop] = value;
    }

    _drawGuideAngleLine(pos, axis, point, color = this._guideColors[axis]) {
        tmpV1.set(0, 0, 0);
        tmpV2.copy(point).mulScalar(this._scale);
        this._app.drawLine(tmpV1.add(pos), tmpV2.add(pos), color, false, this._layer);
    }

    _getLookAtEulerAngles(position) {
        tmpV1.set(0, 0, 0);
        tmpM1.setLookAt(tmpV1, position, Vec3.UP);
        tmpQ1.setFromMat4(tmpM1);
        tmpQ1.getEulerAngles(tmpV1);
        tmpV1.x += 90;
        return tmpV1;
    }

    _faceAxisLookAtCamera() {
        if (this._camera.projection === PROJECTION_PERSPECTIVE) {
            this._shapes.face.entity.lookAt(this._camera.entity.getPosition());
            this._shapes.face.entity.rotateLocal(90, 0, 0);
        } else {
            tmpQ1.copy(this._camera.entity.getRotation());
            tmpQ1.getEulerAngles(tmpV1);
            this._shapes.face.entity.setEulerAngles(tmpV1);
            this._shapes.face.entity.rotateLocal(-90, 0, 0);
        }
    }

    _xyzAxisLookAtCamera() {
        if (this._camera.projection === PROJECTION_PERSPECTIVE) {
            tmpV1.copy(this._camera.entity.getPosition()).sub(this.root.getPosition());
            tmpQ1.copy(this.root.getRotation()).invert().transformVector(tmpV1, tmpV1);
        } else {
            tmpV1.copy(this._camera.entity.forward).mulScalar(-1);
        }
        let angle = Math.atan2(tmpV1.z, tmpV1.y) * math.RAD_TO_DEG;
        this._shapes.x.entity.setLocalEulerAngles(0, angle - 90, -90);
        angle = Math.atan2(tmpV1.x, tmpV1.z) * math.RAD_TO_DEG;
        this._shapes.y.entity.setLocalEulerAngles(0, angle, 0);
        angle = Math.atan2(tmpV1.y, tmpV1.x) * math.RAD_TO_DEG;
        this._shapes.z.entity.setLocalEulerAngles(90, 0, angle + 90);
    }

    _drag(state) {
        for (const axis in this._shapes) {
            const shape = this._shapes[axis];
            if (axis === this._selectedAxis) {
                shape.drag(state);
            } else {
                shape.hide(state);
            }
        }
        this.fire('render:update');
    }

    _storeNodeRotations() {
        const gizmoPos = this.root.getPosition();
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            this._nodeLocalRotations.set(node, node.getLocalRotation().clone());
            this._nodeRotations.set(node, node.getRotation().clone());
            this._nodeOffsets.set(node, node.getPosition().clone().sub(gizmoPos));
        }
    }

    _setNodeRotations(axis, angleDelta) {
        const gizmoPos = this.root.getPosition();
        const cameraPos = this._camera.entity.getPosition();
        const isFacing = axis === 'face';
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];

            if (isFacing) {
                tmpV1.copy(cameraPos).sub(gizmoPos).normalize();
            } else {
                tmpV1.set(0, 0, 0);
                tmpV1[axis] = 1;
            }

            tmpQ1.setFromAxisAngle(tmpV1, angleDelta);

            if (!isFacing && this._coordSpace === GIZMO_LOCAL) {
                tmpQ2.copy(this._nodeLocalRotations.get(node)).mul(tmpQ1);
                node.setLocalRotation(tmpQ2);
            } else {
                tmpV1.copy(this._nodeOffsets.get(node));
                tmpQ1.transformVector(tmpV1, tmpV1);
                tmpQ2.copy(tmpQ1).mul(this._nodeRotations.get(node));

                // Fix: Rotation via quaternion when scale inverted causes scale warping?
                node.setEulerAngles(tmpQ2.getEulerAngles());
                node.setPosition(tmpV1.add(gizmoPos));
            }
        }

        if (this._coordSpace === GIZMO_LOCAL) {
            this._updateRotation();
        }
    }
}

export { RotateGizmo };
