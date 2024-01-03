import {
    createTorus,
    MeshInstance,
    Entity,
    Vec3
} from 'playcanvas'

import { AxisShape, GizmoTransform } from "./gizmo-transform.js";

// temporary variables
const tmpV1 = new Vec3();

class AxisDisk extends AxisShape {
    _tubeRadius = 0.02;

    _ringRadius = 0.55;

    constructor(options = {}) {
        super(options);

        this._createDisk(options.app, options.layers ?? []);
    }

    _createDisk(app, layers) {
        const mesh = createTorus(app.graphicsDevice, {
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
}

class GizmoRotate extends GizmoTransform {
    _rotation = true;

    constructor(app, camera) {
        super(app, camera);

        this._axisShapes = {
            x: new AxisDisk({
                app: app,
                axis: 'x',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(0, 0, -90),
                defaultColor: this._materials.semi.red,
                hoverColor: this._materials.opaque.red
            }),
            y: new AxisDisk({
                app: app,
                axis: 'y',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(0, 0, 0),
                defaultColor: this._materials.semi.green,
                hoverColor: this._materials.opaque.green
            }),
            z: new AxisDisk({
                app: app,
                axis: 'z',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(90, 0, 0),
                defaultColor: this._materials.semi.blue,
                hoverColor: this._materials.opaque.blue
            }),
            // xyz: new AxisDisk({
            //     app: app,
            //     axis: 'xyz',
            //     layers: [this.layerGizmo.id],
            //     defaultColor: this._materials.semi.white,
            //     hoverColor: this._materials.semi.white
            // })
        };

        // this._axisShapes.xyz.entity.lookAt(this.camera.getPosition());
        // this._axisShapes.xyz.entity.rotateLocal(90, 0, 0);

        this._createTransform();

        this.on('transform:start', () => {
            this.storeNodeRotations();
        });

        this.on('transform:move', (axis, offset, angle) => {
            this.updateNodeRotations(axis, angle);
        });
    }

    _createTransform() {
        super._createTransform();

        // elements
        for (const key in this._axisShapes) {
            const shape = this._axisShapes[key];
            this._center.addChild(shape.entity);
            for (let i = 0; i < shape.meshInstances.length; i++) {
                this.elementMap.set(shape.meshInstances[i], shape);
            }
        }
    }

    _updateArrowProp(propName, value) {
        this._axisShapes.x[propName] = value;
        this._axisShapes.y[propName] = value;
        this._axisShapes.z[propName] = value;
    }

    _updatePlaneProp(propName, value) {
        this._axisShapes.yz[propName] = value;
        this._axisShapes.xz[propName] = value;
        this._axisShapes.xy[propName] = value;
    }
}

export { GizmoRotate };
