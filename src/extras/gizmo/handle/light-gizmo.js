import { math } from '../../../core/math/math.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { LIGHTSHAPE_DISK, LIGHTSHAPE_PUNCTUAL, LIGHTSHAPE_RECT, LIGHTSHAPE_SPHERE } from '../../../scene/constants.js';
import { HandleGizmo } from './handle-gizmo.js';

/**
 * @import { CameraComponent } from '../../../framework/components/camera/component.js'
 * @import { Entity } from '../../../framework/entity.js'
 * @import { Layer } from '../../../scene/layer.js'
 * @import { LightComponent } from '../../../framework/components/light/component.js'
 * @import { GizmoHandle } from './handle-gizmo.js'
 */

const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();
const tmpV4 = new Vec3();
const tmpV5 = new Vec3();
const tmpV6 = new Vec3();
const tmpQ1 = new Quat();
const tmpC = new Vec3();

const RECT = [
    new Vec3(-0.5, 0, -0.5),
    new Vec3(0.5, 0, -0.5),
    new Vec3(0.5, 0, 0.5),
    new Vec3(-0.5, 0, 0.5)
];
const rect = RECT.map(() => new Vec3());
const rays = Array.from({ length: 8 }, () => new Vec3());

const FLIP = new Quat().setFromEulerAngles(180, 0, 0);

const RAYS = 8;
const GROUND_RADIUS = 0.12;
const FACE_OPACITY = 3;
const MIN_SIZE = 0.01;

/**
 * Draws the shape of each attached light entity: an arrow for a directional light, sized by
 * {@link Gizmo#size}, the range of an omni light, the cone of a spot light, and the shape of an area
 * light. Handles drag the range, cone angles or area size, which sets the entity's local scale.
 *
 * ```javascript
 * const layer = Gizmo.createLayer(app, 'Overlays', undefined, true);
 * const gizmo = new LightGizmo(cameraComponent, layer);
 * gizmo.attach([lightEntity]);
 * ```
 *
 * Relevant Engine API examples:
 *
 * - [Light Gizmo](https://playcanvas.github.io/#/gizmos/light)
 *
 * @category Gizmo
 */
class LightGizmo extends HandleGizmo {
    /**
     * Whether to draw a dashed line from each local light down to the plane y = 0. Defaults to
     * false.
     *
     * @type {boolean}
     */
    groundLine = false;

    /**
     * Whether to draw each light in its own color. Defaults to false.
     *
     * @type {boolean}
     */
    useLightColor = false;

    /**
     * The local scale of the dragged light at the start of the drag.
     *
     * @private
     */
    _startScale = new Vec3();

    /**
     * The world scale of the dragged light at the start of the drag.
     *
     * @private
     */
    _startWorldScale = new Vec3();

    /**
     * The world scale of the dragged light's parent at the start of the drag.
     *
     * @private
     */
    _startParentScale = new Vec3();

    /**
     * Creates a new LightGizmo object.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The render layer.
     * @example
     * const gizmo = new LightGizmo(camera, layer);
     */
    constructor(camera, layer) {
        super(camera, layer, 'gizmo:light');
    }

    /**
     * Places a dashed line from a light down to the ground.
     *
     * @param {Vec3} pos - The light position.
     * @private
     */
    _ground(pos) {
        if (!this.groundLine || Math.abs(pos.y) < GROUND_RADIUS) {
            return;
        }
        const foot = tmpV5.set(pos.x, 0, pos.z);
        this._renderer.dashed(pos, foot, 0.625, 0.7);
        this._renderer.circle(foot, Vec3.UP, GROUND_RADIUS, 0.625, 0.7);
    }

    /**
     * Places rays along the direction a light shines.
     *
     * @param {Entity} entity - The light entity.
     * @param {Vec3[]} starts - The world start points.
     * @param {number} count - The number of rays.
     * @param {number} length - The ray length.
     * @param {number} [weight] - The thickness as a factor of the line thickness.
     * @param {number} [alpha] - The alpha factor.
     * @private
     */
    _rays(entity, starts, count, length, weight = 0.625, alpha = 0.55) {
        const along = tmpV5.copy(entity.up).mulScalar(-length);
        for (let i = 0; i < count; i++) {
            this._renderer.line(starts[i], tmpV6.add2(starts[i], along), weight, alpha);
        }
    }

    /**
     * Gets a point of a circle in the xz plane of an entity.
     *
     * @param {Entity} entity - The entity.
     * @param {Vec3} center - The circle center.
     * @param {number} radius - The circle radius.
     * @param {number} angle - The angle in radians.
     * @param {Vec3} out - The point.
     * @returns {Vec3} The point.
     * @private
     */
    _circlePoint(entity, center, radius, angle, out) {
        out.copy(entity.right).mulScalar(Math.cos(angle) * radius);
        return out.add(tmpC.copy(entity.forward).mulScalar(Math.sin(angle) * radius)).add(center);
    }

    /**
     * Gets whether a light renders with an area shape.
     *
     * @param {LightComponent} light - The light.
     * @returns {boolean} Whether the light has an area shape.
     * @private
     */
    _isArea(light) {

        // clustered lighting treats local area lights as punctual unless area lights are enabled
        const { scene } = this._app;
        return light.shape !== LIGHTSHAPE_PUNCTUAL &&
            (!scene.clusteredLightingEnabled || light.type === 'directional' || scene.lighting.areaLightsEnabled);
    }

    /**
     * Places the area shape of a light, sized by the entity scale.
     *
     * @param {LightComponent} light - The light to draw.
     * @returns {boolean} False if the light renders as a punctual light.
     * @private
     */
    _drawArea(light) {
        if (!this._isArea(light)) {
            return false;
        }
        const { shape } = light;

        const renderer = this._renderer;
        const { entity } = light;
        const wtm = entity.getWorldTransform();
        const pos = entity.getPosition();
        const rot = entity.getRotation();
        const { x: sx, y: sy, z: sz } = wtm.getScale(tmpV1);
        const volume = this._theme.fill.a > 0;
        const radius = shape === LIGHTSHAPE_RECT ? 0.5 * Math.max(sx, sz) :
            shape === LIGHTSHAPE_DISK ? 0.25 * (sx + sz) : 0.5 * Math.max(sx, sy, sz);
        const detailed = this._detailed(pos, radius);

        switch (shape) {
            case LIGHTSHAPE_RECT: {
                for (let i = 0; i < RECT.length; i++) {
                    wtm.transformPoint(RECT[i], rect[i]);
                }
                if (volume) {
                    renderer.box(pos, rot, tmpV2.set(sx, 1e-3 * (sx + sz), sz), FACE_OPACITY);
                }
                for (let i = 0; i < rect.length; i++) {
                    renderer.line(rect[i], rect[(i + 1) % rect.length], 1.1);
                }
                this._rays(entity, rect, rect.length, 0.17 * (sx + sz));

                // edge midpoints alternate between depth (z) and width (x)
                if (detailed) {
                    for (let i = 0; i < rect.length; i++) {
                        const mid = tmpV2.lerp(rect[i], rect[(i + 1) % rect.length], 0.5);
                        const dir = tmpV3.sub2(mid, pos).normalize();
                        const color = i & 1 ? this._theme.primary : this._theme.tertiary;
                        if (this._handle(mid, color, entity, i & 1 ? 'width' : 'depth', i, pos, dir)) {
                            this._readoutAt(mid, i & 1 ? 'W' : 'D', color, i & 1 ? sx : sz);
                        }
                    }
                }
                break;
            }
            case LIGHTSHAPE_DISK: {
                if (volume) {
                    renderer.cone('disk', pos, rot, tmpV2.set(2 * radius, 2e-3 * radius, 2 * radius), FACE_OPACITY);
                }
                renderer.ring(pos, rot, radius, 1.1);
                for (let i = 0; i < RAYS; i++) {
                    this._circlePoint(entity, pos, radius, 2 * Math.PI * i / RAYS, rays[i]);
                }
                this._rays(entity, rays, RAYS, 0.67 * radius);
                if (detailed) {
                    for (let i = 0; i < 4; i++) {
                        const rim = this._circlePoint(entity, pos, radius, 0.5 * Math.PI * i, tmpV2);
                        if (this._handle(rim, this._theme.primary, entity, 'radius', i, pos, tmpV3.sub2(rim, pos).normalize())) {
                            this._readoutAt(rim, '⌀', this._theme.primary, 2 * radius);
                        }
                    }
                }
                break;
            }
            case LIGHTSHAPE_SPHERE: {
                if (volume) {
                    renderer.sphere(pos, radius, FACE_OPACITY);
                }
                this._sphereOutline(pos, rot, radius);
                if (detailed) {
                    this._sphereHandles(pos, rot, radius, entity, 'radius');
                }
                break;
            }
            default: {
                return true;
            }
        }

        if (shape !== LIGHTSHAPE_SPHERE) {
            renderer.arrow(pos, tmpQ1.copy(rot).mul(FLIP), 0.45 * (sx + sz));
        }
        if (light.type !== 'directional') {
            this._ground(pos);
        }
        this._icon('light', pos, entity);
        return true;
    }

    /**
     * Places the cone of a spot light, capped by arcs of its range.
     *
     * @param {LightComponent} light - The light to draw.
     * @private
     */
    _drawSpot(light) {
        const renderer = this._renderer;
        const { entity, range, innerConeAngle, outerConeAngle } = light;
        const apex = entity.getPosition();
        const dir = tmpV1.copy(entity.up).mulScalar(-1);
        const outer = outerConeAngle * math.DEG_TO_RAD;
        const inner = innerConeAngle * math.DEG_TO_RAD;
        const length = range * Math.cos(outer);
        const radius = range * Math.sin(outer);
        const center = tmpV2.copy(dir).mulScalar(length).add(apex);
        const innerCenter = tmpV3.copy(dir).mulScalar(range * Math.cos(inner)).add(apex);
        const innerRadius = range * Math.sin(inner);

        if (this._theme.fill.a > 0 && length > 1e-4) {
            const mid = tmpV4.copy(dir).mulScalar(0.5 * length).add(apex);
            renderer.cone('cone', mid, entity.getRotation(), tmpV5.set(2 * radius, length, 2 * radius));
        }

        // edges along the entity x and z axes
        for (let i = 0; i < 4; i++) {
            renderer.line(apex, this._circlePoint(entity, center, radius, 0.5 * Math.PI * i, tmpV4));
        }
        renderer.circle(center, dir, radius, 1.1);
        if (innerConeAngle > 0 && innerConeAngle < outerConeAngle) {
            renderer.dashedCircle(innerCenter, dir, innerRadius, 0.625, 0.8);
        }

        // range cap arcs, colored while their angle handle is active
        for (let i = 0; i < 4; i++) {
            const radial = this._circlePoint(entity, Vec3.ZERO, 1, 0.5 * Math.PI * i, tmpV4);
            const color = this._active(entity, 'outerConeAngle', i) ? this._theme.tertiary :
                this._active(entity, 'innerConeAngle', i) ? this._theme.secondary : null;
            renderer.arc(apex, dir, radial, range, 0, outer, color ? 1 : 0.625, color ? 1 : 0.6, color);
        }

        const tip = tmpV4.copy(dir).mulScalar(range).add(apex);
        const ranging = this._active(entity, 'range', 0);
        renderer.dashed(apex, tip, ranging ? 1 : 0.55, ranging ? 1 : 0.6, ranging ? this._theme.primary : null);
        this._icon('light', apex, entity);
        this._ground(apex);

        if (!this._detailed(center, radius)) {
            return;
        }

        // angle handles swing along the range cap arcs
        if (this._handle(tip, this._theme.primary, entity, 'range', 0, apex, dir, false, false)) {
            this._readoutAt(tip, 'r', this._theme.primary, range);
        }
        for (let i = 0; i < 4; i++) {
            const angle = 0.5 * Math.PI * i;
            const radial = this._circlePoint(entity, Vec3.ZERO, 1, angle, tmpV5);
            const normal = tmpV6.cross(radial, dir).normalize();
            const rim = this._circlePoint(entity, center, radius, angle, tmpV4);
            if (this._handle(rim, this._theme.tertiary, entity, 'outerConeAngle', i, apex, normal, true)) {
                this._readoutAt(rim, 'θ<sub>o</sub>', this._theme.tertiary, outerConeAngle, '°');
            }
            if (innerConeAngle > 0) {
                const ring = this._circlePoint(entity, innerCenter, innerRadius, angle, tmpV4);
                if (this._handle(ring, this._theme.secondary, entity, 'innerConeAngle', i, apex, normal, true)) {
                    this._readoutAt(ring, 'θ<sub>i</sub>', this._theme.secondary, innerConeAngle, '°');
                }
            }
        }
    }

    /**
     * Places an arrow through a disc of parallel rays, a constant size on screen.
     *
     * @param {LightComponent} light - The light to draw.
     * @private
     */
    _drawDirectional(light) {
        const renderer = this._renderer;
        const { entity } = light;
        const pos = entity.getPosition();
        const rot = entity.getRotation();
        const scale = this._getScreenScale(pos);
        const radius = 0.24 * scale;

        renderer.ring(pos, rot, radius);
        for (let i = 0; i < RAYS; i++) {
            this._circlePoint(entity, pos, radius, 2 * Math.PI * i / RAYS, rays[i]);
        }
        this._rays(entity, rays, RAYS, 0.58 * scale, 0.7, 0.75);
        renderer.arrow(pos, tmpQ1.copy(rot).mul(FLIP), scale);

        // keep the icon clear of the arrow
        this._icon('light', tmpV3.copy(entity.up).mulScalar(0.18 * scale).add(pos), entity);
    }

    /**
     * Places the outline of an omni light's range.
     *
     * @param {LightComponent} light - The light to draw.
     * @private
     */
    _drawOmni(light) {
        const { entity, range } = light;
        const pos = entity.getPosition();
        this._sphereOutline(pos, Quat.IDENTITY, range);
        this._ground(pos);
        this._icon('light', pos, entity);
        if (this._detailed(pos, range)) {
            this._sphereHandles(pos, Quat.IDENTITY, range, entity, 'range');
        }
    }

    /**
     * Places the shapes of the attached lights.
     *
     * @protected
     * @override
     */
    _drawShapes() {
        for (let i = 0; i < this.nodes.length; i++) {
            const entity = /** @type {Entity} */ (this.nodes[i]);
            const light = entity.light;
            if (!entity.enabled || !light?.enabled) {
                continue;
            }
            this._renderer.tint = this.useLightColor ? light.color : null;
            if (this._drawArea(light)) {
                continue;
            }
            switch (light.type) {
                case 'directional': {
                    this._drawDirectional(light);
                    break;
                }
                case 'omni':
                case 'point': {
                    this._drawOmni(light);
                    break;
                }
                case 'spot': {
                    this._drawSpot(light);
                    break;
                }
            }
        }
        this._renderer.tint = null;
    }

    /**
     * Stores the scale of the dragged light, which area light handles edit.
     *
     * @param {GizmoHandle} handle - The dragged handle.
     * @protected
     * @override
     */
    _startHandle(handle) {
        const entity = /** @type {Entity} */ (handle.node);
        this._startScale.copy(entity.getLocalScale());
        entity.getWorldTransform().getScale(this._startWorldScale);
        const parent = entity.parent;
        if (parent) {
            parent.getWorldTransform().getScale(this._startParentScale);
        } else {
            this._startParentScale.copy(Vec3.ONE);
        }
    }

    /**
     * Edits the range, cone angle or area size of the dragged handle's light.
     *
     * @param {GizmoHandle} handle - The dragged handle.
     * @param {Vec3} point - Where the handle is dragged to.
     * @protected
     * @override
     */
    _moveHandle(handle, point) {
        const entity = /** @type {Entity} */ (handle.node);
        const light = /** @type {LightComponent} */ (entity.light);
        const offset = tmpV1.sub2(point, handle.origin);
        const dist = offset.dot(handle.dir);
        const start = this._startScale;
        const world = this._startWorldScale;
        const parent = this._startParentScale;

        switch (handle.name) {
            case 'range': {
                light.range = Math.max(this._snapLength(dist), MIN_SIZE);
                break;
            }
            case 'outerConeAngle':
            case 'innerConeAngle': {
                const dir = tmpV2.copy(entity.up).mulScalar(-1);
                const along = offset.dot(dir);
                const across = tmpV3.copy(dir).mulScalar(-along).add(offset).length();
                const angle = this._snapAngle(Math.atan2(across, along) * math.RAD_TO_DEG);
                if (handle.name === 'outerConeAngle') {
                    light.outerConeAngle = math.clamp(angle, 1, 89);
                    light.innerConeAngle = Math.min(light.innerConeAngle, light.outerConeAngle);
                } else {
                    light.innerConeAngle = math.clamp(angle, 0, light.outerConeAngle);
                }
                break;
            }
            case 'width': {
                entity.setLocalScale(Math.max(this._snapLength(2 * dist), MIN_SIZE) / parent.x, start.y, start.z);
                break;
            }
            case 'depth': {
                entity.setLocalScale(start.x, start.y, Math.max(this._snapLength(2 * dist), MIN_SIZE) / parent.z);
                break;
            }
            case 'radius': {
                // a disk's radius is a quarter of its width plus depth and snaps by diameter
                const disk = light.shape === LIGHTSHAPE_DISK;
                const radius = disk ? 0.25 * (world.x + world.z) : 0.5 * Math.max(world.x, world.y, world.z);
                const snapped = disk ? 0.5 * this._snapLength(2 * dist) : this._snapLength(dist);
                const factor = Math.max(snapped, MIN_SIZE) / radius;
                entity.setLocalScale(start.x * factor, disk ? start.y : start.y * factor, start.z * factor);
                break;
            }
        }
    }
}

export { LightGizmo };
