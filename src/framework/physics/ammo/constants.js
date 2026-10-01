// Bullet collision flags (btCollisionObject::CollisionFlags) and activation states, set on and
// read from the native bodies of the Ammo backend. They are Bullet values, not engine API: the
// public BODYFLAG_* and BODYSTATE_* aliases of them live in deprecated.js.

export const CF_STATIC_OBJECT = 1;
export const CF_KINEMATIC_OBJECT = 2;
export const CF_NO_CONTACT_RESPONSE = 4;

export const ACTIVE_TAG = 1;
export const ISLAND_SLEEPING = 2;
export const WANTS_DEACTIVATION = 3;
export const DISABLE_DEACTIVATION = 4;
export const DISABLE_SIMULATION = 5;
