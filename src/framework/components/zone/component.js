import { Vec3 } from '../../../core/math/vec3.js';
import { Mat4 } from '../../../core/math/mat4.js';

import { Component } from '../component.js';

const _matrix = new Mat4();

/**
 * The ZoneComponent allows you to define an area in world space of certain size. This can be used
 * in various ways, such as affecting audio reverb when {@link AudioListenerComponent} is within
 * zone. Or create culling system with portals between zones to hide whole indoor sections for
 * performance reasons. And many other possible options. Zones are building blocks and meant to be
 * used in many different ways.
 *
 * @ignore
 */
class ZoneComponent extends Component {
    /**
     * The list of entities currently inside this zone.
     *
     * @type {import('../../entity').Entity[]}
     */
    entities = [];

    /**
     * The collision shape for this zone.
     *
     * @type {Ammo.btCollisionShape|null}
     * @private
     */
    _collisionShape = null;

    /**
     * Last value of halfExtents.
     *
     * @type {Vec3}
     * @ignore
     */
    _halfExtentsLast = new Vec3();

    /**
     * Holds all entities added this frame to the zone.
     *
     * @type {import('../../entity.js').Entity[]}
     * @private
     */
    _frameAdded = [];

    /**
     * Holds all entities removed this frame from the zone.
     *
     * @type {import('../../entity.js').Entity[]}
     * @private
     */
    _frameRemoved = [];

    /**
     * Fired when the zone component is enabled. This event does not take into account the enabled
     * state of the entity or any of its ancestors.
     *
     * @event
     * @example
     * entity.zone.on('enable', () => {
     *     console.log(`Zone component of entity '${entity.name}' has been enabled`);
     * });
     */
    static EVENT_ENABLE = 'enable';

    /**
     * Fired when the zone component is disabled. This event does not take into account the enabled
     * state of the entity or any of its ancestors.
     *
     * @event
     * @example
     * entity.zone.on('disable', () => {
     *     console.log(`Zone component of entity '${entity.name}' has been disabled`);
     * });
     */
    static EVENT_DISABLE = 'disable';

    /**
     * Fired when the enabled state of the zone component changes. This event does not take into
     * account the enabled state of the entity or any of its ancestors.
     *
     * @event
     * @example
     * entity.zone.on('state', (enabled) => {
     *     console.log(`Zone component of entity '${entity.name}' has been ${enabled ? 'enabled' : 'disabled'}`);
     * });
     */
    static EVENT_STATE = 'state';

    /**
     * Fired when a zone component is removed from an entity.
     *
     * @event
     * @example
     * entity.zone.on('remove', () => {
     *     console.log(`Zone component removed from entity '${entity.name}'`);
     * });
     */
    static EVENT_REMOVE = 'remove';

    /**
     * Create a new ZoneComponent instance.
     *
     * @param {import('./system.js').ZoneComponentSystem} system - The ComponentSystem that
     * created this Component.
     * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
     * attached to.
     */
    // eslint-disable-next-line no-useless-constructor
    constructor(system, entity) {
        super(system, entity);
    }

    /**
     * Toggle life cycle listeners for this component.
     *
     * @param {"on"|"off"} onOrOff - Function to use.
     * @private
     */
    _toggleLifecycleListeners(onOrOff) {
        this[onOrOff]('set_useColliders', this._onSetUseColliders, this);
        this[onOrOff]('set_shape', this._onSetShape, this);
        this[onOrOff]('set_halfExtents', this._onSetHalfExtents, this);
        this[onOrOff]('set_radius', this._onSetRadius, this);
    }

    /**
     * Callback function called when property "useColliders" is updated.
     *
     * @private
     */
    _onSetUseColliders() {
        if (!this.useColliders) {
            this._destroyCollisionShape();
        }
    }

    /**
     * Callback function called when property "shape" is updated.
     *
     * @private
     */
    _onSetShape() {
        if (this._collisionShape) {
            this._recreateCollisionShape();
        }
    }

    /**
     * Callback function called when property "halfExtents" is updated.
     *
     * @private
     */
    _onSetHalfExtents() {
        if (this.shape === 'box' && this._collisionShape) {
            this._recreateCollisionShape();
        }
    }

    /**
     * Callback function called when property "radius" is updated.
     *
     * @private
     */
    _onSetRadius() {
        if (this.shape === 'sphere' && this._collisionShape) {
            this._recreateCollisionShape();
        }
    }

    /**
     * Destroy physical shape.
     *
     * @private
     */
    _destroyCollisionShape() {
        if (typeof Ammo !== 'undefined') {
            if (this._collisionShape) {
                Ammo.destroy(this._collisionShape);
                this._collisionShape = null;
            }
        }
    }

    /**
     * Recreate physical shape.
     *
     * @private
     */
    _recreateCollisionShape() {
        if (typeof Ammo !== 'undefined' && this.useColliders) {
            this._destroyCollisionShape();

            const halfExtents = this.halfExtents;
            if (this.shape === 'box' && (halfExtents.x !== 0 || halfExtents.y !== 0 || halfExtents.z !== 0)) {
                const ammoVec3 = new Ammo.btVector3(halfExtents.x, halfExtents.y, halfExtents.z);
                this._collisionShape = new Ammo.btBoxShape(ammoVec3);
                Ammo.destroy(ammoVec3);
            } else if (this.shape === 'sphere' && this.radius > 0) {
                this._collisionShape = new Ammo.btSphereShape(this.radius);
            }
        }
    }

    /**
     * Check if a point is within the zone.
     *
     * @param {Vec3} point - The point to look for.
     * @param {Vec3} position - The position of this entity.
     * @param {import('../../../core/math/quat').Quat} rotation - The rotation of this entity.
     * @param {Mat4} matrix - The matrix for box calculations.
     * @returns {boolean} Whether the point is within the zone.
     * @private
     */
    _isPointInZone(point, position = this.entity.getPosition(), rotation = this.entity.getRotation(), matrix = undefined) {
        if (this.shape === 'box') {
            if (!matrix) {
                matrix = _matrix;
                matrix.setTRS(position, rotation, Vec3.ONE);
                matrix.invert();
            }

            const localPoint = matrix.transformPoint(point);
            const halfExtents = this.halfExtents;
            if (Math.abs(localPoint.x) <= halfExtents.x && Math.abs(localPoint.y) <= halfExtents.y && Math.abs(localPoint.z) <= halfExtents.z) {
                return true;
            }
        } else if (point.distance(position) <= this.radius) {
            return true;
        }

        return false;
    }

    /**
     * Check if a point is within the zone.
     *
     * @param {Vec3} point - The point to look for.
     * @returns {boolean} Whether the point is within the zone.
     */
    isPointInZone(point) {
        return this._isPointInZone(point);
    }

    /**
     * Refresh the list of entities within the zone.
     *
     * @ignore
     */
    checkEntities() {
        if (!this.entity.enabled || !this.enabled) {
            return;
        }

        const position = this.entity.getPosition();
        const rotation = this.entity.getRotation();

        _matrix.setTRS(position, rotation, Vec3.ONE);
        _matrix.invert();

        let pendingCollider;
        const entities = Object.values(this.system.app._entityIndex);

        this._frameAdded.length = 0;
        this._frameRemoved.length = 0;

        // Check entities as per position
        for (let i = 0, l = entities.length; i < l; i++) {
            const entity = entities[i];

            // Don't check for self.
            if (entity === this.entity) {
                continue;
            }

            const index = this.entities.indexOf(entity);

            if (!entity.enabled) {
                if (index !== -1) {
                    this.entities.splice(index, 1);
                }

                continue;
            }

            if (this._isPointInZone(entity.getPosition(), position, rotation, _matrix)) {
                if (index === -1) {
                    this.entities.push(entity);
                    this._frameAdded.push(entity);
                }
            } else if (this.useColliders && entity.collision && entity.collision.enabled && entity.collision.zoneCheck) {
                if (!pendingCollider) {
                    pendingCollider = [];
                }

                pendingCollider.push(entity);
            } else if (index !== -1) {
                this.entities.splice(index, 1);
                this._frameRemoved.push(entity);
            }
        }

        // Check entities as per colliders
        if (this.useColliders && pendingCollider && pendingCollider.length && this.system.app.systems.rigidbody) {
            if (!this._collisionShape) {
                this._recreateCollisionShape();
            }

            if (this._collisionShape) {
                if (!this._halfExtentsLast.equals(this.halfExtents)) {
                    this.fire('set_halfExtents', this._halfExtentsLast, this.halfExtents);
                    this._halfExtentsLast.copy(this.halfExtents);
                }

                const collidingEntities = this.system.app.systems.rigidbody._shapeTestAll(this._collisionShape, position, rotation, false);

                for (let i = 0, l = pendingCollider.length; i < l; i++) {
                    const entity = pendingCollider[i];
                    const collidingIndex = collidingEntities.findIndex(r => r.entity === entity);
                    const inZoneIndex = this.entities.indexOf(entity);

                    if (collidingIndex !== -1 && inZoneIndex !== -1) {
                        // Entity was already in zone.
                        continue;
                    } else if (collidingIndex !== -1) {
                        // Entity entered zone.
                        this.entities.push(entity);
                        this._frameAdded.push(entity);
                    } else if (inZoneIndex !== -1) {
                        // Entity left zone.
                        this.entities.splice(inZoneIndex, 1);
                        this._frameRemoved.push(entity);
                    }
                }
            }
        } else if (this._collisionShape) {
            this._destroyCollisionShape();
        }

        for (const entity of this._frameAdded) {
            entity.fire('zoneEnter', this);
            this.fire('entityEnter', entity);
        }
        for (const entity of this._frameRemoved) {
            entity.fire('zoneLeave', this);
            this.fire('entityleave', entity);
        }
    }

    /**
     * Function called when the component is getting enabled.
     *
     * @ignore
     */
    onEnable() {
        this.system.addZone(this);
        this._toggleLifecycleListeners('on');
        this.checkEntities();
    }

    /**
     * Function called when the component is getting disabled.
     *
     * @ignore
     */
    onDisable() {
        this.system.removeZone(this);
        this._destroyCollisionShape();
        this._toggleLifecycleListeners('off');

        const entities = [...this.entities];
        this.entities.length = 0;

        for (let i = 0, l = entities.length; i < l; i++) {
            entities[i].fire('zoneLeave', this);
        }
    }

    /**
     * Callback function called when component is getting removed.
     *
     * @ignore
     */
    _onBeforeRemove() {
        this.onDisable();
    }
}

export { ZoneComponent };
