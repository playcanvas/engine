import { PhysicsWorld } from '../physics-world.js';

/**
 * A no-op physics backend. The {@link PhysicsWorld} base class is a functional no-op - bodies,
 * shapes and joints are created but inert, raycasts miss and stepping does nothing - so this
 * subclass adds nothing. It exists to let component lifecycle run in tests without a physics
 * engine loaded, and is installed explicitly:
 *
 * ```javascript
 * app.systems.rigidbody.setPhysicsWorld(new NullPhysicsWorld());
 * ```
 *
 * It is never auto-selected - without it, an application with no physics library keeps today's
 * behavior where physics components are inert placeholders.
 *
 * @ignore
 */
class NullPhysicsWorld extends PhysicsWorld {
}

export { NullPhysicsWorld };
