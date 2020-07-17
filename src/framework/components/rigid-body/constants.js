// types
/**
 * @constant
 * @type {string}
 * @name pc.BODYTYPE_STATIC
 * @description Rigid body has infinite mass and cannot move.
 */
export var BODYTYPE_STATIC = 'static';
/**
 * @constant
 * @type {string}
 * @name pc.BODYTYPE_DYNAMIC
 * @description Rigid body is simulated according to applied forces.
 */
export var BODYTYPE_DYNAMIC = 'dynamic';
/**
 * @constant
 * @type {string}
 * @name pc.BODYTYPE_KINEMATIC
 * @description Rigid body has infinite mass and does not respond to forces but can still be moved by setting their velocity or position.
 */
export var BODYTYPE_KINEMATIC = 'kinematic';

// Collision flags
export var BODYFLAG_STATIC_OBJECT = 1;
export var BODYFLAG_KINEMATIC_OBJECT = 2;
export var BODYFLAG_NORESPONSE_OBJECT = 4;

// Activation states
export var BODYSTATE_ACTIVE_TAG = 1;
export var BODYSTATE_ISLAND_SLEEPING = 2;
export var BODYSTATE_WANTS_DEACTIVATION = 3;
export var BODYSTATE_DISABLE_DEACTIVATION = 4;
export var BODYSTATE_DISABLE_SIMULATION = 5;

// groups
export var BODYGROUP_NONE = 0;
export var BODYGROUP_DEFAULT = 1;
export var BODYGROUP_DYNAMIC = 1;
export var BODYGROUP_STATIC = 2;
export var BODYGROUP_KINEMATIC = 4;
export var BODYGROUP_ENGINE_1 = 8;
export var BODYGROUP_TRIGGER = 16;
export var BODYGROUP_ENGINE_2 = 32;
export var BODYGROUP_ENGINE_3 = 64;
export var BODYGROUP_USER_1 = 128;
export var BODYGROUP_USER_2 = 256;
export var BODYGROUP_USER_3 = 512;
export var BODYGROUP_USER_4 = 1024;
export var BODYGROUP_USER_5 = 2048;
export var BODYGROUP_USER_6 = 4096;
export var BODYGROUP_USER_7 = 8192;
export var BODYGROUP_USER_8 = 16384;

// masks
export var BODYMASK_NONE = 0;
export var BODYMASK_ALL = 65535;
export var BODYMASK_STATIC = 2;
export var BODYMASK_NOT_STATIC = 65535 ^ 2;
export var BODYMASK_NOT_STATIC_KINEMATIC = 65535 ^ (2 | 4);
