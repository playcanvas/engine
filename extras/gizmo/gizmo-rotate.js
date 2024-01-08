import {
    Quat,
    Vec3
} from 'playcanvas';

import { AxisDisk } from './axis-shapes.js';
import { GizmoTransform } from "./gizmo-transform.js";

// temporary variables
const tmpV1 = new Vec3();
const tmpQ1 = new Quat();
const tmpQ2 = new Quat();

class GizmoRotate extends GizmoTransform {
    _axisShapes = {
        z: new AxisDisk({
            device: this.app.graphicsDevice,
            axis: 'z',
            layers: [this.layer.id],
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._materials.axis.z,
            hoverColor: this._materials.hover
        }),
        x: new AxisDisk({
            device: this.app.graphicsDevice,
            axis: 'x',
            layers: [this.layer.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._materials.axis.x,
            hoverColor: this._materials.hover
        }),
        y: new AxisDisk({
            device: this.app.graphicsDevice,
            axis: 'y',
            layers: [this.layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._materials.axis.y,
            hoverColor: this._materials.hover
        }),
        face: new AxisDisk({
            device: this.app.graphicsDevice,
            axis: 'face',
            layers: [this.layer.id],
            defaultColor: this._materials.axis.face,
            hoverColor: this._materials.hover,
            ringRadius: 0.8
        })
    };

    _isRotation = true;

    _ring;

    _nodeLocalRotations = new Map();

    _nodeRotations = new Map();

    _nodeOffsets = new Map();

    snapIncrement = 5;

    constructor(...args) {
        super(...args);

        this._createTransform();

        this.on('transform:start', () => {
            this._setFacingDisks();
            this._storeNodeRotations();
        });

        this.on('transform:move', (axis, offset, angle) => {
            if (this.snap) {
                angle = Math.round(angle / this.snapIncrement) * this.snapIncrement;
            }
            this._setFacingDisks();
            this._setNodeRotations(axis, angle);
        });

        this.on('coordSpace:set', () => {
            this._setFacingDisks();
        });

        this.on('nodes:attach', () => {
            this._setFacingDisks();
        });

        this.on('nodes:detach', () => {
            this._nodeLocalRotations.clear();
            this._nodeRotations.clear();
            this._nodeOffsets.clear();
        });
    }

    set axisTubeRadius(value) {
        this._setDiskProp('tubeRadius', value);
    }

    get axisTubeRadius() {
        return this._axisShapes.x.tubeRadius;
    }

    set axisRingRadius(value) {
        this._setDiskProp('ringRadius', value);
    }

    get axisRingRadius() {
        return this._axisShapes.x.ringRadius;
    }

    set faceTubeRadius(value) {
        this._axisShapes.face.tubeRadius = value;
    }

    get faceTubeRadius() {
        return this._axisShapes.face.tubeRadius;
    }

    set faceRingRadius(value) {
        this._axisShapes.face.ringRadius = value;
    }

    get faceRingRadius() {
        return this._axisShapes.face.ringRadius;
    }

    _setDiskProp(propName, value) {
        this._axisShapes.x[propName] = value;
        this._axisShapes.y[propName] = value;
        this._axisShapes.z[propName] = value;
        this._ring[propName] = value;
    }

    _setFacingDisks() {
        this._faceDiskToCamera(this._ring.entity);
        this._faceDiskToCamera(this._axisShapes.face.entity);
    }

    _faceDiskToCamera(entity) {
        entity.lookAt(this.camera.getPosition());
        entity.rotateLocal(90, 0, 0);
    }

    _createTransform() {
        super._createTransform();

        // shapes
        for (const key in this._axisShapes) {
            const shape = this._axisShapes[key];
            this._center.addChild(shape.entity);
            for (let i = 0; i < shape.meshInstances.length; i++) {
                this._shapeMap.set(shape.meshInstances[i], shape);
            }
        }

        // guide ring
        this._ring = new AxisDisk({
            device: this.app.graphicsDevice,
            layers: [this.layer.id],
            defaultColor: this._materials.guide
        });
        this._center.addChild(this._ring.entity);
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
        const cameraPos = this.camera.getPosition();
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
