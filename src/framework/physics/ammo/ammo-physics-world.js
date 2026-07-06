import { Debug } from '../../../core/debug.js';
import { PhysicsWorld } from '../physics-world.js';

/**
 * @import { Vec3 } from '../../../core/math/vec3.js'
 */

/**
 * The Ammo.js (Bullet) physics backend. Expects the `Ammo` global to be available when
 * constructed - the RigidBodyComponentSystem only creates it after the Ammo WasmModule has
 * loaded.
 *
 * @ignore
 */
class AmmoPhysicsWorld extends PhysicsWorld {
    /** @private */
    _gravityFloat32 = new Float32Array(3);

    /**
     * Create a new AmmoPhysicsWorld instance.
     *
     * @param {object} [options] - The world options.
     * @param {Function} [options.onTick] - Raw simulation tick callback, invoked per fixed
     * substep with (worldPointer, timeStep) on ammo builds that support internal tick
     * callbacks.
     */
    constructor(options = {}) {
        super(options);

        this.collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
        this.dispatcher = new Ammo.btCollisionDispatcher(this.collisionConfiguration);
        this.overlappingPairCache = new Ammo.btDbvtBroadphase();
        this.solver = new Ammo.btSequentialImpulseConstraintSolver();
        this.nativeWorld = new Ammo.btDiscreteDynamicsWorld(this.dispatcher, this.overlappingPairCache, this.solver, this.collisionConfiguration);

        if (this.nativeWorld.setInternalTickCallback) {
            const checkForCollisionsPointer = Ammo.addFunction(options.onTick, 'vif');
            this.nativeWorld.setInternalTickCallback(checkForCollisionsPointer);
        } else {
            Debug.warn('WARNING: This version of ammo.js can potentially fail to report contacts. Please update it to the latest version.');
        }
    }

    destroy() {
        Ammo.destroy(this.nativeWorld);
        Ammo.destroy(this.solver);
        Ammo.destroy(this.overlappingPairCache);
        Ammo.destroy(this.dispatcher);
        Ammo.destroy(this.collisionConfiguration);
        this.nativeWorld = null;
        this.solver = null;
        this.overlappingPairCache = null;
        this.dispatcher = null;
        this.collisionConfiguration = null;
    }

    /**
     * @param {Vec3} gravity - The world space gravity.
     */
    setGravity(gravity) {
        // downcast gravity to float32 so we can accurately compare with existing gravity set
        // in the world
        this._gravityFloat32[0] = gravity.x;
        this._gravityFloat32[1] = gravity.y;
        this._gravityFloat32[2] = gravity.z;

        // compare against the world's own value so writes through the native escape hatch are
        // still detected
        const current = this.nativeWorld.getGravity();
        if (current.x() !== this._gravityFloat32[0] ||
            current.y() !== this._gravityFloat32[1] ||
            current.z() !== this._gravityFloat32[2]) {
            current.setValue(gravity.x, gravity.y, gravity.z);
            this.nativeWorld.setGravity(current);
        }
    }

    step(dt, maxSubSteps, fixedTimeStep) {
        this.nativeWorld.stepSimulation(dt, maxSubSteps, fixedTimeStep);
    }
}

export { AmmoPhysicsWorld };
