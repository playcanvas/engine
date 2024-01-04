import {
    createTorus,
    MeshInstance,
    Entity,
    Quat,
    Vec3
} from 'playcanvas'

import { AxisShape, GizmoTransform } from "./gizmo-transform.js";

// temporary variables
const tmpV1 = new Vec3();
const tmpQ1 = new Quat();
const tmpQ2 = new Quat();

class AxisDisk extends AxisShape {
    _device;

    _tubeRadius = 0.02;

    _ringRadius = 0.55;

    constructor(options = {}) {
        super(options);

        this._device = options.device;
        this._ringRadius = options.ringRadius ?? this._ringRadius;
        this._createDisk(options.layers ?? []);
    }

    _createDisk(layers) {
        const mesh = createTorus(this._device, {
            tubeRadius: this._tubeRadius,
            ringRadius: this._ringRadius
        });
        const meshInstance = new MeshInstance(mesh, this._defaultColor);

        this.entity = new Entity('disk_' + this.axis);
        this.entity.addComponent('render', {
            meshInstances: [meshInstance],
            layers: layers,
            castShadows: false
        });
        this.entity.setLocalPosition(this._position);
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._scale);
        this.meshInstances.push(meshInstance);
    }

    set tubeRadius(value) {
        this._tubeRadius = value ?? 0.1;
        this.meshInstances[0].mesh = createTorus(this._device, {
            tubeRadius: this._tubeRadius,
            ringRadius: this._ringRadius
        });
    }

    get tubeRadius() {
        return this._tubeRadius;
    }

    set ringRadius(value) {
        this._ringRadius = value ?? 0.1;
        this.meshInstances[0].mesh = createTorus(this._device, {
            tubeRadius: this._tubeRadius,
            ringRadius: this._ringRadius
        });
    }

    get ringRadius() {
        return this._ringRadius;
    }
}

class GizmoRotate extends GizmoTransform {
    _rotation = true;

    _ring;

    _nodeLocalRotations = new Map();

    _nodeRotations = new Map();

    _nodeOffsets = new Map();

    constructor(app, camera) {
        super(app, camera);

        this._axisShapes = {
            x: new AxisDisk({
                device: app.graphicsDevice,
                axis: 'x',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(0, 0, -90),
                defaultColor: this._materials.opaque.red,
                hoverColor: this._materials.opaque.yellow
            }),
            y: new AxisDisk({
                device: app.graphicsDevice,
                axis: 'y',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(0, 0, 0),
                defaultColor: this._materials.opaque.green,
                hoverColor: this._materials.opaque.yellow
            }),
            z: new AxisDisk({
                device: app.graphicsDevice,
                axis: 'z',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(90, 0, 0),
                defaultColor: this._materials.opaque.blue,
                hoverColor: this._materials.opaque.yellow
            }),
            face: new AxisDisk({
                app: app,
                axis: 'face',
                layers: [this.layerGizmo.id],
                defaultColor: this._materials.semi.yellow,
                hoverColor: this._materials.opaque.yellow,
                ringRadius: 0.8
            })
        };

        this._createTransform();
        this._setFacingDisks();

        this.on('transform:start', () => {
            this._setFacingDisks();
            this._storeNodeRotations();
        });

        this.on('transform:move', (axis, offset, angle) => {
            this._setFacingDisks();
            this._setNodeRotations(axis, angle);
        });
    }

    set tubeRadius(value) {
        this._setDiskProp('tubeRadius', value);
    }

    get tubeRadius() {
        return this._axisShapes.x.tubeRadius;
    }

    set ringRadius(value) {
        this._setDiskProp('ringRadius', value);
    }

    get ringRadius() {
        return this._axisShapes.x.ringRadius;
    }

    _setDiskProp(propName, value) {
        this._axisShapes.x[propName] = value;
        this._axisShapes.y[propName] = value;
        this._axisShapes.z[propName] = value;
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

        // guide ring
        this._ring = new AxisDisk({
            app: this.app,
            layers: [this.layerGizmo.id],
            defaultColor: this._materials.semi.white
        });
        this._center.addChild(this._ring.entity);

        // elements
        for (const key in this._axisShapes) {
            const shape = this._axisShapes[key];
            this._center.addChild(shape.entity);
            for (let i = 0; i < shape.meshInstances.length; i++) {
                this.elementMap.set(shape.meshInstances[i], shape);
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
            this.updateGizmoRotation();
        }
    }

    detach() {
        super.detach();

        this._nodeLocalRotations.clear();
        this._nodeRotations.clear();
        this._nodeOffsets.clear();
    }
}

export { GizmoRotate };
