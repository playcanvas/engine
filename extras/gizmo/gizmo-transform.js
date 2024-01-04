import {
    math,
    PROJECTION_PERSPECTIVE,
    BLEND_NORMAL,
    Color,
    StandardMaterial,
    Entity,
    Vec3,
    Quat
} from 'playcanvas'

import { Gizmo } from "./gizmo.js";

// temporary variables
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpQ1 = new Quat();

// constants
const VEC3_AXES = Object.keys(tmpV1);
const GUIDELINE_SIZE = 1e6;

class AxisShape {
    _position;

    _rotation;

    _scale;

    _defaultColor;

    _hoverColor;

    axis;

    entity;

    meshInstances = [];

    constructor(options) {
        this.axis = options.axis ?? 'x';
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

class GizmoTransform extends Gizmo {
    _materials;

    _guideLineColor = new Color(1, 1, 1, 0.5);

    _hoverAxis = '';

    _hoverIsPlane = false;

    _currAxis = '';

    _currIsPlane = false;

    _pointStart = new Vec3();

    _angleStart = 0;

    _offset = new Vec3();

    _dirtyElement;

    _rotation = false;

    dragging = false;

    elements;

    elementMap = new Map();

    constructor(app, camera) {
        super(app, camera);

        this._materials = {
            opaque: {
                red: this._createMaterial(new Color(1, 0.3, 0.3)),
                green: this._createMaterial(new Color(0.3, 1, 0.3)),
                blue: this._createMaterial(new Color(0.3, 0.3, 1)),
                yellow: this._createMaterial(new Color(1, 1, 0.3)),
                white: this._createMaterial(new Color(1, 1, 1))
            },
            semi: {
                red: this._createMaterial(new Color(1, 0.3, 0.3, 0.5)),
                green: this._createMaterial(new Color(0.3, 1, 0.3, 0.5)),
                blue: this._createMaterial(new Color(0.3, 0.3, 1, 0.5)),
                yellow: this._createMaterial(new Color(1, 1, 0.3, 0.5)),
                white: this._createMaterial(new Color(1, 1, 1, 0.5))
            }
        };

        this.app.on('update', () => {
            if (!this.gizmo.enabled) {
                return;
            }
            const gizmoPos = this.gizmo.getPosition();
            tmpQ1.copy(this.gizmo.getRotation());
            const checkAxis = this._hoverAxis || this._currAxis;
            const checkIsPlane = this._hoverIsPlane || this._currIsPlane;
            for (let i = 0; i < VEC3_AXES.length; i++) {
                const axis = VEC3_AXES[i];
                if (checkAxis === 'xyz') {
                    this._drawGuideLine(gizmoPos, axis);
                    continue;
                }
                if (checkIsPlane) {
                    if (axis !== checkAxis) {
                        this._drawGuideLine(gizmoPos, axis);
                    }
                } else {
                    if (axis === checkAxis) {
                        this._drawGuideLine(gizmoPos, axis);
                    }
                }
            }
        });

        this.on('pointer:move', (x, y, meshInstance) => {
            this._hover(meshInstance);

            if (this.dragging) {
                const pointInfo = this._calcPoint(x, y);
                this._offset.copy(pointInfo.point).sub(this._pointStart);
                this.fire('transform:move', this._currAxis, this._offset, pointInfo.angle - this._angleStart);
                this._hoverAxis = '';
                this._hoverIsPlane = false;
            }
        });

        this.on('pointer:down', (x, y, meshInstance) => {
            if (this.dragging) {
                return;
            }
            if (meshInstance) {
                this._currAxis = this._getAxis(meshInstance);
                this._currIsPlane =  this._getIsPlane(meshInstance);
                const pointInfo = this._calcPoint(x, y);
                this._pointStart.copy(pointInfo.point);
                this._angleStart = pointInfo.angle;
                this.fire('transform:start', this._pointStart);
                this.dragging = true;
            }
        });

        this.on('pointer:up', () => {
            this.dragging = false;
            this._currAxis = '';
            this._currIsPlane = false;
        });
    }

    _getAxis(meshInstance) {
        if (!meshInstance) {
            return '';
        }
        return meshInstance.node.name.split("_")[1];
    }

    _getIsPlane(meshInstance) {
        if (!meshInstance) {
            return false;
        }
        return meshInstance.node.name.indexOf('plane') !== -1;
    }

    _hover(meshInstance) {
        if (this.dragging) {
            return;
        }
        this._hoverAxis = this._getAxis(meshInstance);
        this._hoverIsPlane =  this._getIsPlane(meshInstance);
        const shape = this.elementMap.get(meshInstance);
        if (shape === this._dirtyElement) {
            return;
        }
        if (this._dirtyElement) {
            this._dirtyElement.hover(false);
            this._dirtyElement = null;
        }
        if (shape) {
            shape.hover(true);
            this._dirtyElement = shape;
        }
    }

    _calcPoint(x, y) {
        const gizmoPos = this.gizmo.getPosition();
        const mouseWPos = this.camera.camera.screenToWorld(x, y, 1);
        const rayOrigin = this.camera.getPosition();
        const rayDir = new Vec3();
        const planeNormal = new Vec3();
        const axis = this._currAxis;
        const isPlane = this._currIsPlane;
        const isRotation = this._rotation;
        const isAllAxes = axis === 'xyz';
        const isFacing = axis === 'face';

        // calculate ray direction from mouse position
        if (this.camera.camera.projection === PROJECTION_PERSPECTIVE) {
            rayDir.copy(mouseWPos).sub(rayOrigin).normalize();
        } else {
            rayOrigin.add(mouseWPos);
            this.camera.getWorldTransform().transformVector(tmpV1.set(0, 0, -1), rayDir);
        }

        if (isAllAxes || isFacing) {
            // all axes so set normal to plane facing camera
            planeNormal.copy(rayOrigin).sub(gizmoPos).normalize();
        } else {
            // set plane normal based on axis
            planeNormal[axis] = 1;

            // rotate plane normal by gizmo rotation
            tmpQ1.copy(this.gizmo.getRotation()).transformVector(planeNormal, planeNormal);

            if (!isPlane && !isRotation) {
                tmpV1.copy(rayOrigin).sub(gizmoPos).normalize();
                planeNormal.copy(tmpV1.sub(planeNormal.scale(planeNormal.dot(tmpV1))).normalize());
            }
        }

        // ray intersection with plane
        const rayPlaneDot = planeNormal.dot(rayDir);
        const planeDist = gizmoPos.dot(planeNormal);
        const pointPlaneDist = (planeNormal.dot(rayOrigin) - planeDist) / rayPlaneDot;
        const point = rayDir.scale(-pointPlaneDist).add(rayOrigin);

        if (isRotation) {
            // point needs to be relative to gizmo for angle calculation
            point.sub(gizmoPos);
        }

        if (isAllAxes) {
            // calculate point distance from gizmo
            tmpV1.copy(point).sub(gizmoPos).normalize();
            tmpV2.copy(this.camera.up).add(this.camera.right).normalize();

            const v = point.sub(gizmoPos).length() * tmpV1.dot(tmpV2);
            point.set(v, v, v);
        } else if (!isFacing) {
            if (!isPlane && !isRotation) {
                // reset normal based on axis and project position from plane onto normal
                planeNormal.set(0, 0, 0);
                planeNormal[axis] = 1;
                tmpQ1.transformVector(planeNormal, planeNormal);
                point.copy(planeNormal.scale(planeNormal.dot(point)));
            }

            // rotate point back to world coords
            tmpQ1.invert().transformVector(point, point);

            if (!isPlane && !isRotation) {
                // set other axes to zero if not plane point
                const v = point[axis];
                point.set(0, 0, 0);
                point[axis] = v;
            }
        }

        let angle = 0;
        if (isRotation) {
            switch (axis) {
                case 'x':
                    angle = Math.atan2(point.z, point.y) * math.RAD_TO_DEG;
                    break;
                case 'y':
                    angle = Math.atan2(point.x, point.z) * math.RAD_TO_DEG;
                    break;
                case 'z':
                case 'face':
                    angle = Math.atan2(point.y, point.x) * math.RAD_TO_DEG;
                    break;
            }
        }
        return { point, angle };
    }

    _drawGuideLine(pos, axis) {
        tmpV1.set(0, 0, 0);
        tmpV1[axis] = 1;
        tmpV1.scale(GUIDELINE_SIZE);
        tmpV2.copy(tmpV1).scale(-1);
        tmpQ1.transformVector(tmpV1, tmpV1);
        tmpQ1.transformVector(tmpV2, tmpV2);
        this.app.drawLine(tmpV1.add(pos), tmpV2.add(pos), this._guideLineColor, true, this.layerGizmo);
    }

    _createMaterial(color) {
        const material = new StandardMaterial();
        material.emissive = color;
        if (color.a !== 1) {
            material.opacity = color.a;
            material.blendType = BLEND_NORMAL;
        }
        return material;
    }

    // _createLight(angles) {
    //     const light = new Entity('light');
    //     light.addComponent('light', {
    //         layers: [this.layerGizmo.id]
    //     });
    //     light.setEulerAngles(angles);
    //     return light;
    // }

    _createTransform() {
        // lighting
        // const light = this._createLight(new Vec3(45, 0, -45));
        // this.gizmo.addChild(light);

        // center
        this._center = new Entity('center');
        this.gizmo.addChild(this._center);
    }
}

export { AxisShape, GizmoTransform };
