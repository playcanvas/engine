import {
    math,
    Color,
    Quat,
    Mat4,
    Vec3
} from 'playcanvas';

import { AxisDisk } from './axis-shapes.js';
import { LOCAL_COORD_SPACE } from './gizmo.js';
import { GizmoTransform } from "./gizmo-transform.js";

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpM1 = new Mat4();
const tmpQ1 = new Quat();
const tmpQ2 = new Quat();

/**
 * Rotation gizmo.
 *
 * @augments GizmoTransform
 */
class GizmoRotate extends GizmoTransform {
    _shapes = {
        z: new AxisDisk(this.app.graphicsDevice, {
            axis: 'z',
            layers: [this.layer.id],
            rotation: new Vec3(90, 0, 90),
            defaultColor: this._materials.axis.z.cullBack,
            hoverColor: this._materials.hover.z.cullBack,
            sectorAngle: Math.PI
        }),
        x: new AxisDisk(this.app.graphicsDevice, {
            axis: 'x',
            layers: [this.layer.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._materials.axis.x.cullBack,
            hoverColor: this._materials.hover.x.cullBack,
            sectorAngle: Math.PI
        }),
        y: new AxisDisk(this.app.graphicsDevice, {
            axis: 'y',
            layers: [this.layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._materials.axis.y.cullBack,
            hoverColor: this._materials.hover.y.cullBack,
            sectorAngle: Math.PI
        }),
        face: new AxisDisk(this.app.graphicsDevice, {
            axis: 'face',
            layers: [this.layer.id],
            rotation: this._getLookAtEulerAngles(this.camera.entity.getPosition()),
            defaultColor: this._materials.axis.face,
            hoverColor: this._materials.hover.face,
            ringRadius: 0.63
        })
    };

    _isRotation = true;

    /**
     * Internal mapping from each attached node to their starting rotation (euler angles) in local space.
     *
     * @type {Map<import('playcanvas').GraphNode, Vec3>}
     * @private
     */
    _nodeLocalRotations = new Map();

    /**
     * Internal mapping from each attached node to their starting rotation (euler angles) in world space.
     *
     * @type {Map<import('playcanvas').GraphNode, Vec3>}
     * @private
     */
    _nodeRotations = new Map();

    /**
     * Internal mapping from each attached node to their offset position from the gizmo.
     *
     * @type {Map<import('playcanvas').GraphNode, Vec3>}
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

    snapIncrement = 5;

    /**
     * Creates a new GizmoRotate object.
     *
     * @param {import('playcanvas').AppBase} app - The application instance.
     * @param {import('playcanvas').CameraComponent} camera - The camera component.
     * @param {import('playcanvas').Layer} layer - The render layer.
     * @example
     * const gizmo = new pcx.GizmoRotate(app, camera, layer);
     */
    constructor(app, camera, layer) {
        super(app, camera, layer);

        this._createTransform();

        this.on('transform:start', () => {
            this._storeNodeRotations();
            this._updateGuideAngle(this._selectionStartPoint, this._guideAngleStart);
            this._updateGuideAngle(this._selectionStartPoint, this._guideAngleEnd);
            this._drag(true);
        });

        this.on('transform:move', (pointDelta, angleDelta, pointLast) => {
            if (this.snap) {
                angleDelta = Math.round(angleDelta / this.snapIncrement) * this.snapIncrement;
            }
            this._setNodeRotations(this._selectedAxis, angleDelta);
            this._updateGuideAngle(pointLast, this._guideAngleEnd);
        });

        this.on('transform:end', () => {
            this._drag(false);
        });

        this.on('nodes:detach', () => {
            this._nodeLocalRotations.clear();
            this._nodeRotations.clear();
            this._nodeOffsets.clear();
        });

        this.app.on('update', () => {
            const cameraPos = this.camera.entity.getPosition();
            this._faceAxisLookAt(cameraPos);
            this._xyzAxisLookAt(cameraPos);

            if (this._dragging) {
                const gizmoPos = this.gizmo.getPosition();
                this._drawGuideAngleLine(gizmoPos, this._selectedAxis,
                                         this._guideAngleStart, this._guideAngleStartColor);
                this._drawGuideAngleLine(gizmoPos, this._selectedAxis, this._guideAngleEnd);
            }
        });
    }

    set xyzTubeRadius(value) {
        this._setDiskProp('tubeRadius', value);
    }

    get xyzTubeRadius() {
        return this._shapes.x.tubeRadius;
    }

    set xyzRingRadius(value) {
        this._setDiskProp('ringRadius', value);
    }

    get xyzRingRadius() {
        return this._shapes.x.ringRadius;
    }

    set faceTubeRadius(value) {
        this._shapes.face.tubeRadius = value;
    }

    get faceTubeRadius() {
        return this._shapes.face.tubeRadius;
    }

    set faceRingRadius(value) {
        this._shapes.face.ringRadius = value;
    }

    get faceRingRadius() {
        return this._shapes.face.ringRadius;
    }

    set intersectionTolerance(value) {
        this._setDiskProp('intersectionTolerance', value);
        this._shapes.face.intersectionTolerance = value;
    }

    get intersectionTolerance() {
        return this._shapes.x.intersectionTolerance;
    }

    _setDiskProp(prop, value) {
        this._shapes.x[prop] = value;
        this._shapes.y[prop] = value;
        this._shapes.z[prop] = value;
    }

    _updateGuideAngle(point, out) {
        const axis = this._selectedAxis;
        const scale = axis === 'face' ? this.faceRingRadius : this.xyzRingRadius;
        out.copy(point).normalize();
        out.scale(scale);
        this._gizmoRotationStart.transformVector(out, out);
    }

    _drawGuideAngleLine(pos, axis, point, color = this._guideColors[axis]) {
        tmpV1.set(0, 0, 0);
        tmpV2.copy(point).scale(this._scale);
        this.app.drawLine(tmpV1.add(pos), tmpV2.add(pos), color, false, this.layer);
    }

    _getLookAtEulerAngles(position) {
        tmpV1.set(0, 0, 0);
        tmpM1.setLookAt(tmpV1, position, Vec3.UP);
        tmpQ1.setFromMat4(tmpM1);
        tmpQ1.getEulerAngles(tmpV1);
        tmpV1.x -= 90;
        return tmpV1;
    }

    _faceAxisLookAt(position) {
        this._shapes.face.entity.lookAt(position);
        this._shapes.face.entity.rotateLocal(90, 0, 0);
    }

    _xyzAxisLookAt(position) {
        tmpV1.copy(position).sub(this.gizmo.getPosition());
        tmpQ1.copy(this.gizmo.getRotation()).invert().transformVector(tmpV1, tmpV1);
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
    }

    _storeNodeRotations() {
        const gizmoPos = this.gizmo.getPosition();
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            this._nodeLocalRotations.set(node, node.getLocalRotation().clone());
            this._nodeRotations.set(node, node.getRotation().clone());
            this._nodeOffsets.set(node, node.getPosition().clone().sub(gizmoPos));
        }
    }

    _setNodeRotations(axis, angleDelta) {
        const gizmoPos = this.gizmo.getPosition();
        const cameraPos = this.camera.entity.getPosition();
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

            if (!isFacing && this._coordSpace === LOCAL_COORD_SPACE) {
                tmpQ2.copy(this._nodeLocalRotations.get(node)).mul(tmpQ1);
                node.setLocalRotation(tmpQ2);
            } else {
                tmpV1.copy(this._nodeOffsets.get(node));
                tmpQ1.transformVector(tmpV1, tmpV1);
                tmpQ2.copy(tmpQ1).mul(this._nodeRotations.get(node));
                node.setRotation(tmpQ2);
                node.setPosition(tmpV1.add(gizmoPos));
            }
        }

        if (this._coordSpace === LOCAL_COORD_SPACE) {
            this._updateRotation();
        }
    }
}

export { GizmoRotate };
