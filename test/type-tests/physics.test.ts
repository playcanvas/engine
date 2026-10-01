// Consumer-side type tests for the physics components and systems. Compiled by
// `npm run test:types` against build/playcanvas.d.ts, so they exercise exactly what an
// application sees.
import {
    BODYFLAG_KINEMATIC_OBJECT, BODYSTATE_DISABLE_DEACTIVATION, CollisionComponent,
    CollisionComponentSystem, Entity, RigidBodyComponentSystem
} from '../../build/playcanvas.js';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

declare const collision: CollisionComponent;
declare const collisionSystem: CollisionComponentSystem;
declare const system: RigidBodyComponentSystem;

// ---- the type of a collision volume is one of the shape names
type T1 = Expect<Equal<CollisionComponent['type'], 'box' | 'capsule' | 'compound' | 'cone' | 'cylinder' | 'mesh' | 'sphere'>>;
collision.type = 'capsule';
// @ts-expect-error not a collision shape
collision.type = 'teapot';
// @ts-expect-error not a collision shape
new Entity().addComponent('collision', { type: 'teapot' });

// ---- the physics systems keep their bookkeeping private
// @ts-expect-error private
system.addBody(null, 1, 1);
// @ts-expect-error private
system.removeBody(null);
// @ts-expect-error private
system.onContactPair(null);
// @ts-expect-error private
system.collisions;
// @ts-expect-error private
system.contactPointPool;
// @ts-expect-error private
collisionSystem.onRemove(new Entity());

// ---- the native escape hatches and Bullet constants stay available for existing Ammo code
system.dynamicsWorld.setGravity(null);
collision.shape.setMargin(0.01);
type T2 = Expect<Equal<typeof BODYSTATE_DISABLE_DEACTIVATION, 4>>;
type T3 = Expect<Equal<typeof BODYFLAG_KINEMATIC_OBJECT, 2>>;

export type Checks = [T1, T2, T3];
