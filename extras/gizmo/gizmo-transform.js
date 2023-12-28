import {
    BLEND_NORMAL,
    Color,
    StandardMaterial,
    Entity,
    Vec3
} from 'playcanvas'

import { Gizmo } from "./gizmo.js";

// temporary variables
const position = new Vec3();

class TransformElement {
    _position;

    _rotation;

    _scale;

    _defaultColor;

    _hoverColor;

    name;

    entity;

    meshInstances = [];

    constructor(options) {
        this.name = options.name ?? 'INVALID';
        this._position = options.position ?? new Vec3();
        this._rotation = options.rotation ?? new Vec3();
        this._scale = options.scale ?? new Vec3(1, 1, 1);

        this._defaultColor = options.defaultColor ?? Color.BLACK;
        this._hoverColor = options.hoverColor ?? Color.WHITE;
    }

    hover(state) {
        const material = state ? this._hoverColor : this._defaultColor;
        for (let i = 0; i < this.meshInstances.length; i++) {
            this.meshInstances[i].material = material;
        }
    }
}

class Plane extends TransformElement {
    constructor(options) {
        super(options);

        this._createPlane(options.layers ?? []);
    }

    _createPlane(layers) {
        this.entity = new Entity('plane');
        this.entity.addComponent('render', {
            type: 'plane',
            layers: layers,
            material: this._defaultColor,
            castShadows: false
        });
        this.entity.setLocalPosition(this._position);
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._scale);
        this.meshInstances.push(...this.entity.render.meshInstances);
    }
}

class Axis extends TransformElement {
    _gap = 0;

    _lineThickness = 0.04;

    _lineLength = 0.5;

    _arrowThickness = 0.15;

    _arrowLength = 0.2;

    constructor(options = {}) {
        super(options);

        this._createAxis(options.layers ?? []);
    }

    set gap(value) {
        this._gap = value ?? 0;
        this._updateLine();
        this._updateArrow();
    }

    get gap() {
        return this._gap;
    }

    set lineThickness(value) {
        this._lineThickness = value ?? 1;
        this._updateLine();
        this._updateArrow();
    }

    get lineThickness() {
        return this._lineThickness;
    }

    set lineLength(value) {
        this._lineLength = value ?? 1;
        this._updateLine();
        this._updateArrow();
    }

    get lineLength() {
        return this._lineLength;
    }

    set arrowThickness(value) {
        this._arrowThickness = value ?? 1;
        this._updateArrow();
    }

    get arrowThickness() {
        return this._arrowThickness;
    }

    set arrowLength(value) {
        this._arrowLength = value ?? 1;
        this._updateArrow();
    }

    get arrowLength() {
        return this._arrowLength;
    }

    _createAxis(layers) {
        this.entity = new Entity('axis');
        this.entity.setLocalPosition(this._position);
        this.entity.setLocalEulerAngles(this._rotation);
        this.entity.setLocalScale(this._scale);

        this._line = new Entity('line');
        this._line.addComponent('render', {
            type: 'cylinder',
            layers: layers,
            material: this._defaultColor,
            castShadows: false
        });
        this._updateLine();
        this.entity.addChild(this._line);
        this.meshInstances.push(...this._line.render.meshInstances);

        this._arrow = new Entity('arrow');
        this._arrow.addComponent('render', {
            type: 'cone',
            layers: layers,
            material: this._defaultColor,
            castShadows: false
        });
        this._updateArrow();
        this.entity.addChild(this._arrow);
        this.meshInstances.push(...this._arrow.render.meshInstances);
    }

    _updateLine() {
        this._line.setLocalPosition(new Vec3(0, this._gap + this._lineLength * 0.5, 0));
        this._line.setLocalScale(new Vec3(this._lineThickness, this._lineLength, this._lineThickness));
    }

    _updateArrow() {
        this._arrow.setLocalPosition(new Vec3(0, this._gap + this._arrowLength * 0.5 + this._lineLength, 0));
        this._arrow.setLocalScale(new Vec3(this._arrowThickness, this._arrowLength, this._arrowThickness));
    }
}

class GizmoTransform extends Gizmo {
    materials;

    elements;

    elementMap = new Map();

    _dirtyElement;

    constructor(app, camera) {
        super(app, camera);

        this.materials = {
            opaque: {
                red: this._createMaterial(new Color(1, 0.3, 0.3)),
                green: this._createMaterial(new Color(0.3, 1, 0.3)),
                blue: this._createMaterial(new Color(0.3, 0.3, 1))
            },
            semi: {
                red: this._createMaterial(new Color(1, 0.3, 0.3, 0.5)),
                green: this._createMaterial(new Color(0.3, 1, 0.3, 0.5)),
                blue: this._createMaterial(new Color(0.3, 0.3, 1, 0.5))
            }
        };

        this.elements = {
            x: new Axis({
                name: 'x',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(0, 0, -90),
                defaultColor: this.materials.semi.red,
                hoverColor: this.materials.opaque.red
            }),
            y: new Axis({
                name: 'y',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(0, 0, 0),
                defaultColor: this.materials.semi.green,
                hoverColor: this.materials.opaque.green
            }),
            z: new Axis({
                name: 'z',
                layers: [this.layerGizmo.id],
                rotation: new Vec3(90, 0, 0),
                defaultColor: this.materials.semi.blue,
                hoverColor: this.materials.opaque.blue
            }),
            yz: new Plane({
                name: 'yz',
                layers: [this.layerGizmo.id],
                position: new Vec3(0, 0.1, 0.1),
                rotation: new Vec3(0, 0, -90),
                scale: new Vec3(0.2, 0.2, 0.2),
                defaultColor: this.materials.semi.red,
                hoverColor: this.materials.opaque.red
            }),
            xz: new Plane({
                name: 'xz',
                layers: [this.layerGizmo.id],
                position: new Vec3(0.1, 0, 0.1),
                rotation: new Vec3(0, 0, 0),
                scale: new Vec3(0.2, 0.2, 0.2),
                defaultColor: this.materials.semi.green,
                hoverColor: this.materials.opaque.green
            }),
            xy: new Plane({
                name: 'xy',
                layers: [this.layerGizmo.id],
                position: new Vec3(0.1, 0.1, 0),
                rotation: new Vec3(90, 0, 0),
                scale: new Vec3(0.2, 0.2, 0.2),
                defaultColor: this.materials.semi.blue,
                hoverColor: this.materials.opaque.blue
            })
        };

        this._createTransform();

        this.on('gizmo:hover', (meshInstance) => {
            const element = this.elementMap.get(meshInstance);
            if (element === this._dirtyElement) {
                return;
            }
            if (this._dirtyElement) {
                this._dirtyElement.hover(false);
                this._dirtyElement = null;
            }
            if (element) {
                element.hover(true);
                this._dirtyElement = element;
            }
        });

        this.on('gizmo:hold', (meshInstance, target) => {
            const element = this.elementMap.get(meshInstance);
            position.copy(this.gizmo.getPosition());
            switch (element.name) {
                case 'x':
                    position.x = target.x;
                    break;
                case 'y':
                    position.y = target.y;
                    break;
                case 'z':
                    position.z = target.z;
                    break;
                case 'yz':
                    position.y = target.y;
                    position.z = target.z;
                    break;
                case 'xz':
                    position.x = target.x;
                    position.z = target.z;
                    break;
                case 'xy':
                    position.x = target.x;
                    position.y = target.y;
                    break;
            }
            this.gizmo.setPosition(position);
        });
    }

    set axisGap(value) {
        this._updateAxisProp('gap', value ?? 0);
    }

    get axisGap() {
        return this.elements.x.gap;
    }

    set axisLineThickness(value) {
        this._updateAxisProp('lineThickness', value ?? 1);
    }

    get axisLineThickness() {
        return this.elements.x.lineThickness;
    }

    set axisLineLength(value) {
        this._updateAxisProp('lineLength', value ?? 1);
    }

    get axisLineLength() {
        return this.elements.x.lineLength;
    }

    set axisArrowThickness(value) {
        this._updateAxisProp('arrowThickness', value ?? 1);
    }

    get axisArrowThickness() {
        return this.elements.x.arrowThickness;
    }

    set axisArrowLength(value) {
        this._axisArrowLength = value ?? 1;
        this._updateAxisProp('arrowLength', this._axisArrowLength);
    }

    get axisArrowLength() {
        return this.elements.x.arrowLength;
    }

    _createMaterial(color) {
        const material = new StandardMaterial();
        material.diffuse = color;
        if (color.a !== 1) {
            material.opacity = color.a;
            material.blendType = BLEND_NORMAL;
        }
        return material;
    }

    _createLight(angles) {
        const light = new Entity('light');
        light.addComponent('light', {
            layers: [this.layerGizmo.id]
        });
        light.setEulerAngles(angles);
        return light;
    }

    _createTransform() {
        // lighting
        const light = this._createLight(new Vec3(45, 0, -45));
        this.gizmo.addChild(light);

        // center
        const center = new Entity('center');
        this.gizmo.addChild(center);

        // elements
        for (const key in this.elements) {
            const element = this.elements[key];
            center.addChild(element.entity);
            for (let i = 0; i < element.meshInstances.length; i++) {
                this.elementMap.set(element.meshInstances[i], element);
            }
        }
    }

    _updateAxisProp(propName, value) {
        this.elements.x[propName] = value;
        this.elements.y[propName] = value;
        this.elements.z[propName] = value;
    }
}

export { GizmoTransform };
