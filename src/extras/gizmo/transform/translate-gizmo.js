import { Vec3 } from '../../../core/math/vec3.js';
import { Quat } from '../../../core/math/quat.js';

import { TransformGizmo } from './transform-gizmo.js';
import { PlaneShape } from '../shape/plane-shape.js';
import { ArrowShape } from '../shape/arrow-shape.js';
import { SphereShape } from '../shape/sphere-shape.js';

/**
 * @import { CameraComponent } from '../../../framework/components/camera/component.js'
 * @import { GraphNode } from '../../../scene/graph-node.js'
 * @import { Layer } from '../../../scene/layer.js'
 * @import { GizmoAxis } from '../constants.js'
 */

const v1 = new Vec3();
const v2 = new Vec3();
const point = new Vec3();
const delta = new Vec3();
const q = new Quat();

const AXES = /** @type {('x' | 'y' | 'z')[]} */ (['x', 'y', 'z']);

/**
 * Handles for moving {@link Entity}s: arrows along the X, Y and Z axes, planes between them and a
 * center sphere that moves in the view plane. Works with mouse, keyboard and touch input.
 *
 * ```javascript
 * // Create a layer for rendering all gizmos
 * const gizmoLayer = Gizmo.createLayer(app);
 *
 * // Create a translate gizmo
 * const gizmo = new TranslateGizmo(cameraComponent, gizmoLayer);
 *
 * // Create an entity to attach the gizmo to
 * const entity = new Entity();
 * entity.addComponent('render', {
 *     type: 'box'
 * });
 * app.root.addChild(entity);
 *
 * // Attach the gizmo to the entity
 * gizmo.attach([entity]);
 * ```
 *
 * Relevant Engine API examples:
 *
 * - [Translate Gizmo](https://playcanvas.github.io/#/gizmos/transform-translate)
 * - [Editor](https://playcanvas.github.io/#/misc/editor)
 *
 * @category Gizmo
 */
class TranslateGizmo extends TransformGizmo {
    _shapes = {
        xyz: new SphereShape(this._device, {
            axis: 'xyz',
            layers: [this._layer.id],
            defaultColor: this._theme.shapeBase.xyz,
            hoverColor: this._theme.shapeHover.xyz,
            disabledColor: this._theme.disabled
        }),
        yz: new PlaneShape(this._device, {
            axis: 'x',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._theme.shapeBase.x,
            hoverColor: this._theme.shapeHover.x,
            disabledColor: this._theme.disabled,
            depth: 1
        }),
        xz: new PlaneShape(this._device, {
            axis: 'y',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._theme.shapeBase.y,
            hoverColor: this._theme.shapeHover.y,
            disabledColor: this._theme.disabled,
            depth: 1
        }),
        xy: new PlaneShape(this._device, {
            axis: 'z',
            layers: [this._layer.id],
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._theme.shapeBase.z,
            hoverColor: this._theme.shapeHover.z,
            disabledColor: this._theme.disabled,
            depth: 1
        }),
        x: new ArrowShape(this._device, {
            axis: 'x',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, -90),
            defaultColor: this._theme.shapeBase.x,
            hoverColor: this._theme.shapeHover.x,
            disabledColor: this._theme.disabled
        }),
        y: new ArrowShape(this._device, {
            axis: 'y',
            layers: [this._layer.id],
            rotation: new Vec3(0, 0, 0),
            defaultColor: this._theme.shapeBase.y,
            hoverColor: this._theme.shapeHover.y,
            disabledColor: this._theme.disabled
        }),
        z: new ArrowShape(this._device, {
            axis: 'z',
            layers: [this._layer.id],
            rotation: new Vec3(90, 0, 0),
            defaultColor: this._theme.shapeBase.z,
            hoverColor: this._theme.shapeHover.z,
            disabledColor: this._theme.disabled
        })
    };

    /**
     * The local position of each attached node at the start of a drag.
     *
     * @type {Map<GraphNode, Vec3>}
     * @private
     */
    _nodeLocalPositions = new Map();

    /**
     * The world position of each attached node at the start of a drag.
     *
     * @type {Map<GraphNode, Vec3>}
     * @private
     */
    _nodePositions = new Map();

    /**
     * Flips the planes to face the camera.
     */
    flipPlanes = true;

    /**
     * Creates a new TranslateGizmo object. Use {@link Gizmo.createLayer} to create its layer.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The layer responsible for rendering the gizmo.
     * @example
     * const gizmo = new TranslateGizmo(camera, layer);
     */
    constructor(camera, layer) {
        super(camera, layer, 'gizmo:translate');

        this._createTransform();

        this.on(TransformGizmo.EVENT_TRANSFORMSTART, () => {
            this._storeNodePositions();

            // hide the unselected shapes
            this._drag(true);

            this.fire(TransformGizmo.EVENT_TRANSFORMREADOUT, this._selectedAxis, this._selectedIsPlane, Vec3.ZERO);
        });

        this.on(TransformGizmo.EVENT_TRANSFORMMOVE, (point) => {
            const translateDelta = delta.copy(point).sub(this._selectionStartPoint);
            this._snapVector(translateDelta, this.snapIncrement);
            this._setNodePositions(translateDelta);

            this.fire(TransformGizmo.EVENT_TRANSFORMREADOUT, this._selectedAxis, this._selectedIsPlane, translateDelta);
        });

        this.on(TransformGizmo.EVENT_TRANSFORMREADOUT, (_axis, _isPlane, value) => {
            if (!this._readout) {
                return;
            }
            this._showReadout(this._readoutAxes(value));
        });

        this.on(TransformGizmo.EVENT_TRANSFORMEND, () => {

            // show all shapes
            this._drag(false);
        });

        this.on(TransformGizmo.EVENT_NODESDETACH, () => {
            this._nodeLocalPositions.clear();
            this._nodePositions.clear();
        });
    }

    /**
     * Sets the axis gap.
     *
     * @type {number}
     */
    set axisGap(value) {
        this._setArrowProp('gap', value);
    }

    /**
     * Gets the axis gap.
     *
     * @type {number}
     */
    get axisGap() {
        return this._shapes.x.gap;
    }

    /**
     * Sets the axis line thickness.
     *
     * @type {number}
     */
    set axisLineThickness(value) {
        this._setArrowProp('lineThickness', value);
    }

    /**
     * Gets the axis line thickness.
     *
     * @type {number}
     */
    get axisLineThickness() {
        return this._shapes.x.lineThickness;
    }

    /**
     * Sets the axis line length.
     *
     * @type {number}
     */
    set axisLineLength(value) {
        this._setArrowProp('lineLength', value);
    }

    /**
     * Gets the axis line length.
     *
     * @type {number}
     */
    get axisLineLength() {
        return this._shapes.x.lineLength;
    }

    /**
     * Sets the axis line tolerance.
     *
     * @type {number}
     */
    set axisLineTolerance(value) {
        this._setArrowProp('tolerance', value);
    }

    /**
     * Gets the axis line tolerance.
     *
     * @type {number}
     */
    get axisLineTolerance() {
        return this._shapes.x.tolerance;
    }

    /**
     * Sets the arrow thickness.
     *
     * @type {number}
     */
    set axisArrowThickness(value) {
        this._setArrowProp('arrowThickness', value);
    }

    /**
     * Gets the arrow thickness.
     *
     * @type {number}
     */
    get axisArrowThickness() {
        return this._shapes.x.arrowThickness;
    }

    /**
     * Sets the arrow length.
     *
     * @type {number}
     */
    set axisArrowLength(value) {
        this._setArrowProp('arrowLength', value);
    }

    /**
     * Gets the arrow length.
     *
     * @type {number}
     */
    get axisArrowLength() {
        return this._shapes.x.arrowLength;
    }

    /**
     * Sets the plane size.
     *
     * @type {number}
     */
    set axisPlaneSize(value) {
        this._setPlaneProp('size', value);
    }

    /**
     * Gets the plane size.
     *
     * @type {number}
     */
    get axisPlaneSize() {
        return this._shapes.yz.size;
    }

    /**
     * Sets the plane gap.
     *
     * @type {number}
     */
    set axisPlaneGap(value) {
        this._setPlaneProp('gap', value);
    }

    /**
     * Gets the plane gap.
     *
     * @type {number}
     */
    get axisPlaneGap() {
        return this._shapes.yz.gap;
    }

    /**
     * Sets the plane fill opacity, as a factor of the theme color alpha. Defaults to 0.35.
     *
     * @type {number}
     */
    set axisPlaneOpacity(value) {
        this._setPlaneProp('opacity', value);
    }

    /**
     * Gets the plane fill opacity.
     *
     * @type {number}
     */
    get axisPlaneOpacity() {
        return this._shapes.yz.opacity;
    }

    /**
     * Sets the plane outline thickness; 0 hides the outline. Defaults to 0.01.
     *
     * @type {number}
     */
    set axisPlaneOutlineThickness(value) {
        this._setPlaneProp('outlineThickness', value);
    }

    /**
     * Gets the plane outline thickness.
     *
     * @type {number}
     */
    get axisPlaneOutlineThickness() {
        return this._shapes.yz.outlineThickness;
    }

    /**
     * Sets the view angle in degrees below which an axis or plane fades out, hiding at about 8
     * degrees. Defaults to 25.
     *
     * @type {number}
     */
    set axisFadeAngle(value) {
        this._fadeAngle = value ?? this._fadeAngle;
        this._shapesLookAtCamera();
    }

    /**
     * Gets the angle in degrees below which an axis or plane fades out.
     *
     * @type {number}
     */
    get axisFadeAngle() {
        return this._fadeAngle;
    }

    /**
     * Sets the axis center size.
     *
     * @type {number}
     */
    set axisCenterSize(value) {
        this._shapes.xyz.radius = value;
    }

    /**
     * Gets the axis center size.
     *
     * @type {number}
     */
    get axisCenterSize() {
        return this._shapes.xyz.radius;
    }

    /**
     * @type {boolean}
     * @deprecated Use {@link flipPlanes} instead.
     * @ignore
     */
    set flipShapes(value) {
        this.flipPlanes = value;
    }

    /**
     * @type {boolean}
     * @deprecated Use {@link flipPlanes} instead.
     * @ignore
     */
    get flipShapes() {
        return this.flipPlanes;
    }

    /**
     * @param {string} prop - The property to set.
     * @param {any} value - The value to set.
     * @private
     */
    _setArrowProp(prop, value) {
        this._shapes.x[prop] = value;
        this._shapes.y[prop] = value;
        this._shapes.z[prop] = value;
    }

    /**
     * @param {string} prop - The property to set.
     * @param {any} value - The value to set.
     * @private
     */
    _setPlaneProp(prop, value) {
        this._shapes.yz[prop] = value;
        this._shapes.xz[prop] = value;
        this._shapes.xy[prop] = value;
    }

    /**
     * @private
     */
    _shapesLookAtCamera() {
        const cameraDir = this.cameraDir;

        // axes and planes fade out as the view looks along them
        let changed = this._glance(this._shapes.x, Math.abs(cameraDir.dot(this.root.right)));
        changed = this._glance(this._shapes.y, Math.abs(cameraDir.dot(this.root.up))) || changed;
        changed = this._glance(this._shapes.z, Math.abs(cameraDir.dot(this.root.forward))) || changed;

        let flipped;
        v1.cross(cameraDir, this.root.right);
        changed = this._glance(this._shapes.yz, v1.length()) || changed;
        flipped = this.flipPlanes ? v2.set(0, +(v1.dot(this.root.forward) < 0), +(v1.dot(this.root.up) < 0)) : Vec3.ZERO;
        if (!this._shapes.yz.flipped.equals(flipped)) {
            this._shapes.yz.flipped = flipped;
            changed = true;
        }
        v1.cross(cameraDir, this.root.forward);
        changed = this._glance(this._shapes.xy, v1.length()) || changed;
        flipped = this.flipPlanes ? v2.set(+(v1.dot(this.root.up) < 0), +(v1.dot(this.root.right) > 0), 0) : Vec3.ZERO;
        if (!this._shapes.xy.flipped.equals(flipped)) {
            this._shapes.xy.flipped = flipped;
            changed = true;
        }
        v1.cross(cameraDir, this.root.up);
        changed = this._glance(this._shapes.xz, v1.length()) || changed;
        flipped = this.flipPlanes ? v2.set(+(v1.dot(this.root.forward) > 0), 0, +(v1.dot(this.root.right) > 0)) : Vec3.ZERO;
        if (!this._shapes.xz.flipped.equals(flipped)) {
            this._shapes.xz.flipped = flipped;
            changed = true;
        }

        if (changed) {
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
            switch (this.dragMode) {
                case 'show': {
                    continue;
                }
                case 'hide': {
                    shape.visible = !state;
                    continue;
                }
                case 'selected': {
                    if (this._selectedAxis === 'xyz') {
                        shape.visible = state ? axis.length === 1 : true;
                        continue;
                    }
                    if (this._selectedIsPlane) {
                        shape.visible = state ? axis.length === 1 && !axis.includes(this._selectedAxis) : true;
                        continue;
                    }
                    shape.visible = state ? axis === this._selectedAxis : true;
                }
            }
        }

        this._renderUpdate = true;
    }

    /**
     * @private
     */
    _storeNodePositions() {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            this._nodeLocalPositions.set(node, node.getLocalPosition().clone());
            this._nodePositions.set(node, node.getPosition().clone());
        }
    }

    /**
     * @param {Vec3} translateDelta - The offset from the start positions.
     * @private
     */
    _setNodePositions(translateDelta) {
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];

            if (this._coordSpace === 'local') {
                const pos = this._nodeLocalPositions.get(node);
                if (!pos) {
                    continue;
                }
                v1.copy(translateDelta);
                v2.set(1, 1, 1);
                node.parent?.getWorldTransform().getScale(v2);
                v2.x = 1 / v2.x;
                v2.y = 1 / v2.y;
                v2.z = 1 / v2.z;
                q.copy(node.getLocalRotation()).transformVector(v1, v1);
                v1.mul(v2);
                node.setLocalPosition(v1.add(pos));
            } else {
                const pos = this._nodePositions.get(node);
                if (!pos) {
                    continue;
                }
                node.setPosition(v1.copy(translateDelta).add(pos));
            }
        }

        this._updatePosition();
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
        const isPlane = this._selectedIsPlane;

        const ray = this._createRay(mouseWPos);
        const plane = this._createPlane(axis, axis === 'xyz', !isPlane);
        if (!plane.intersectsRay(ray, point)) {
            return point;
        }

        // into the frame of the gizmo at the start of the drag
        q.copy(this._rootStartRot).invert().transformVector(point, point);

        if (!isPlane && axis !== 'xyz') {
            this._projectToAxis(point, axis);
        }

        return point;
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
            if (this._dragging || activeAxis === 'xyz') {
                this._drawSpanLine(pos, rot, axis);
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
}

export { TranslateGizmo };
