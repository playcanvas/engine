import { PhysicsWorld } from '../physics-world.js';

/**
 * A no-op physics backend. The {@link PhysicsWorld} base class is a functional no-op - bodies,
 * shapes and joints are created but inert, raycasts miss and stepping does nothing - so this
 * subclass adds nothing. It exists to let physics component lifecycle run without a physics
 * engine loaded, and is installed explicitly:
 *
 * ```javascript
 * const options = new AppOptions();
 * options.physicsWorld = new NullPhysicsWorld();
 * ```
 *
 * It is never auto-selected - without it, an application with no physics library keeps the
 * default behavior where physics components are inert placeholders.
 *
 * @category Physics
 * @alpha
 */
class NullPhysicsWorld extends PhysicsWorld {
}

export { NullPhysicsWorld };
