import { Vec3 } from '../../../math/vec3.js';

import { BODYGROUP_STATIC, BODYMASK_NOT_STATIC, BODYTYPE_STATIC } from './constants.js';

/**
 * @private
 * @class
 * @name RigidBodyComponentData
 * @augments ComponentData
 * @classdesc Contains data for the RigidBodyComponent.
 * @description Create a new data structure for a RigidBodyComponent.
 */
class RigidBodyComponentData {
    constructor() {
        this.enabled = true;
        this.mass = 1;
        this.linearDamping = 0;
        this.angularDamping = 0;
        this.linearFactor = new Vec3(1, 1, 1);
        this.angularFactor = new Vec3(1, 1, 1);

        this.friction = 0.5;
        this.rollingFriction = 0;
        this.restitution = 0;

        this.type = BODYTYPE_STATIC;

        this.group = BODYGROUP_STATIC;
        this.mask = BODYMASK_NOT_STATIC;

        // Non-serialized properties
        this.body = null;
        this.simulationEnabled = false;
    }
}

export { RigidBodyComponentData };
