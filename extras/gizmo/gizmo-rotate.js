import {
    Quat,
    Vec3
} from 'playcanvas';

import { AxisDisk } from './axis-shapes.js';
import { GizmoTransform } from "./gizmo-transform.js";

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpQ1 = new Quat();
const tmpQ2 = new Quat();

/**
 * Rotation gizmo.
 *
 * @augments GizmoTransform
 */
class GizmoRotate extends GizmoTransform {
    _shapes = {
        z: new AxisDisk({
            device: this.app.graphicsDevice,
            axis: 'z',
            layers: [this.layer.id],
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._materials.axis.z.cullBack,
            hoverColor: this._materials.hover.cullBack
        }),
        x: new AxisDisk({
            device: this.app.graphicsDevice,
            axis: 'x',
            layers: [this.layer.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._materials.axis.x.cullBack,
            hoverColor: this._materials.hover.cullBack
        }),
        y: new AxisDisk({
            device: this.app.graphicsDevice,
            axis: 'y',
            layers: [this.layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._materials.axis.y.cullBack,
            hoverColor: this._materials.hover.cullBack
        }),
        face: new AxisDisk({
            device: this.app.graphicsDevice,
            axis: 'face',
            layers: [this.layer.id],
            defaultColor: this._materials.axis.face,
            hoverColor: this._materials.hover.cullBack,
            ringRadius: 0.8
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

    snapIncrement = 5;

    /**
     * Creates a new GizmoRotate object.
     *
     * @param {import('playcanvas').AppBase} app - The application instance.
     * @param {import('playcanvas').CameraComponent} camera - The camera component.
     * @example
     * const gizmo = new pcx.GizmoRotate(app, camera);
     */
    constructor(app, camera) {
        super(app, camera);

        this._createTransform();

        const guideAngleLine = new Vec3();
        this.on('transform:start', (point) => {
            guideAngleLine.copy(point).normalize().scale(this.xyzRingRadius);
            this._storeNodeRotations();
        });

        this.on('transform:move', (axis, isPlane, offset, angle, point) => {
            guideAngleLine.copy(point).normalize().scale(this.xyzRingRadius);
            if (this.snap) {
                angle = Math.round(angle / this.snapIncrement) * this.snapIncrement;
            }
            this._setNodeRotations(axis, angle);
        });

        this.on('nodes:detach', () => {
            this._nodeLocalRotations.clear();
            this._nodeRotations.clear();
            this._nodeOffsets.clear();
        });

        this.app.on('update', () => {
            this._faceDiskToCamera(this._shapes.face.entity);
            if (this._dragging) {
                this._drawGuideAngleLine(guideAngleLine);
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

    _setDiskProp(prop, value) {
        this._shapes.x[prop] = value;
        this._shapes.y[prop] = value;
        this._shapes.z[prop] = value;
    }

    _drawGuideAngleLine(point) {
        const gizmoPos = this.gizmo.getPosition();
        tmpV1.set(0, 0, 0);
        tmpV2.copy(point).scale(this._scale);
        this.app.drawLine(tmpV1.add(gizmoPos), tmpV2.add(gizmoPos), this.guideLineColor, false, this.layer);
    }

    _faceDiskToCamera(entity) {
        entity.lookAt(this.camera.entity.getPosition());
        entity.rotateLocal(90, 0, 0);
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

    _setNodeRotations(axis, angle) {
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

            tmpQ1.setFromAxisAngle(tmpV1, angle);

            if (!isFacing && this._coordSpace === 'local') {
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

        if (this._coordSpace === 'local') {
            this._updateRotation();
        }
    }
}

export { GizmoRotate };
