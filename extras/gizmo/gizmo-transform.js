import {
    BLEND_NORMAL,
    Color,
    StandardMaterial,
    Entity,
    Vec3
} from 'playcanvas'

import { Gizmo } from "./gizmo.js";

class Axis {
    entity;

    meshInstances = [];

    constructor(options = {}) {
        this._position = options.position ?? new Vec3();
        this._rotation = options.rotation ?? new Vec3();
        this._scale = options.scale ?? new Vec3(1, 1, 1);

        this._defaultColor = options.defaultColor ?? Color.BLACK;
        this._hoverColor = options.hoverColor ?? Color.WHITE;

        this._gap = 0;
        this._lineThickness = 0.04;
        this._lineLength = 0.5;
        this._arrowThickness = 0.15;
        this._arrowLength = 0.2;

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

    hover(state) {
        const material = state ? this._hoverColor : this._defaultColor;
        for (let i = 0; i < this.meshInstances.length; i++) {
            this.meshInstances[i].material = material;
        }
    }
}

class GizmoTransform extends Gizmo {
    constructor(app, camera, nodes) {
        super(app, camera, nodes);

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

        this.axes = {
            x: new Axis({
                layers: [this.layerGizmo.id],
                rotation: new Vec3(0, 0, 90),
                defaultColor: this.materials.semi.red,
                hoverColor: this.materials.opaque.red
            }),
            y: new Axis({
                layers: [this.layerGizmo.id],
                rotation: new Vec3(0, 0, 0),
                defaultColor: this.materials.semi.green,
                hoverColor: this.materials.opaque.green
            }),
            z: new Axis({
                layers: [this.layerGizmo.id],
                rotation: new Vec3(90, 0, 0),
                defaultColor: this.materials.semi.blue,
                hoverColor: this.materials.opaque.blue
            })
        };
        this.axisMap = new Map();

        this._createTransform();
    }

    set axisGap(value) {
        this._updateAxisProp('gap', value ?? 0);
    }

    get axisGap() {
        return this.axes.x.gap;
    }

    set axisLineThickness(value) {
        this._updateAxisProp('lineThickness', value ?? 1);
    }

    get axisLineThickness() {
        return this.axes.x.lineThickness;
    }

    set axisLineLength(value) {
        this._updateAxisProp('lineLength', value ?? 1);
    }

    get axisLineLength() {
        return this.axes.x.lineLength;
    }

    set axisArrowThickness(value) {
        this._updateAxisProp('arrowThickness', value ?? 1);
    }

    get axisArrowThickness() {
        return this.axes.x.arrowThickness;
    }

    set axisArrowLength(value) {
        this._axisArrowLength = value ?? 1;
        this._updateAxisProp('arrowLength', this._axisArrowLength);
    }

    get axisArrowLength() {
        return this.axes.x.arrowLength;
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
        const light = this._createLight(new Vec3(45, -20, 0));
        this.gizmo.addChild(light);

        // center
        const center = new Entity('center');
        center.setEulerAngles(0, 45, 0);
        this.gizmo.addChild(center);

        // axes
        for (const key in this.axes) {
            const axis = this.axes[key];
            center.addChild(axis.entity);
            for (let i = 0; i < axis.meshInstances.length; i++) {
                this.axisMap.set(axis.meshInstances[i], axis);
            }
        }
    }

    _updateAxisProp(propName, value) {
        this.axes.x[propName] = value;
        this.axes.y[propName] = value;
        this.axes.z[propName] = value;
    }

    _handleHover(selection) {
        const axis = this.axisMap.get(selection);
        if (axis === this._dirtyAxis) {
            return;
        }
        if (this._dirtyAxis) {
            this._dirtyAxis.hover(false);
            this._dirtyAxis = null;
        }
        if (axis) {
            axis.hover(true);
            this._dirtyAxis = axis;
        }
    }
}

export { GizmoTransform };
