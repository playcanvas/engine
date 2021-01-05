// types
/**
 * @constant
 * @type {string}
 * @name pc.BODYTYPE_STATIC
 * @description Rigid body has infinite mass and cannot move.
 */
export const BODYTYPE_STATIC = 'static';
/**
 * @constant
 * @type {string}
 * @name pc.BODYTYPE_DYNAMIC
 * @description Rigid body is simulated according to applied forces.
 */
export const BODYTYPE_DYNAMIC = 'dynamic';
/**
 * @constant
 * @type {string}
 * @name pc.BODYTYPE_KINEMATIC
 * @description Rigid body has infinite mass and does not respond to forces but can still be moved by setting their velocity or position.
 */
export const BODYTYPE_KINEMATIC = 'kinematic';

// Collision flags
export const BODYFLAG_STATIC_OBJECT = 1;
export const BODYFLAG_KINEMATIC_OBJECT = 2;
export const BODYFLAG_NORESPONSE_OBJECT = 4;

// Activation states
export const BODYSTATE_ACTIVE_TAG = 1;
export const BODYSTATE_ISLAND_SLEEPING = 2;
export const BODYSTATE_WANTS_DEACTIVATION = 3;
export const BODYSTATE_DISABLE_DEACTIVATION = 4;
export const BODYSTATE_DISABLE_SIMULATION = 5;

// groups
export const BODYGROUP_NONE = 0;
export const BODYGROUP_DEFAULT = 1;
export const BODYGROUP_DYNAMIC = 1;
export const BODYGROUP_STATIC = 2;
export const BODYGROUP_KINEMATIC = 4;
export const BODYGROUP_ENGINE_1 = 8;
export const BODYGROUP_TRIGGER = 16;
export const BODYGROUP_ENGINE_2 = 32;
export const BODYGROUP_ENGINE_3 = 64;
export const BODYGROUP_USER_1 = 128;
export const BODYGROUP_USER_2 = 256;
export const BODYGROUP_USER_3 = 512;
export const BODYGROUP_USER_4 = 1024;
export const BODYGROUP_USER_5 = 2048;
export const BODYGROUP_USER_6 = 4096;
export const BODYGROUP_USER_7 = 8192;
export const BODYGROUP_USER_8 = 16384;

// masks
export const BODYMASK_NONE = 0;
export const BODYMASK_ALL = 65535;
export const BODYMASK_STATIC = 2;
export const BODYMASK_NOT_STATIC = 65535 ^ 2;
export const BODYMASK_NOT_STATIC_KINEMATIC = 65535 ^ (2 | 4);
