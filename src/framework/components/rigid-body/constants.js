Object.assign(pc, {
    // types
    /**
     * @constant
     * @type {string}
     * @name pc.BODYTYPE_STATIC
     * @description Rigid body has infinite mass and cannot move.
     */
    BODYTYPE_STATIC: 'static',
    /**
     * @constant
     * @type {string}
     * @name pc.BODYTYPE_DYNAMIC
     * @description Rigid body is simulated according to applied forces.
     */
    BODYTYPE_DYNAMIC: 'dynamic',
    /**
     * @constant
     * @type {string}
     * @name pc.BODYTYPE_KINEMATIC
     * @description Rigid body has infinite mass and does not respond to forces but can still be moved by setting their velocity or position.
     */
    BODYTYPE_KINEMATIC: 'kinematic',

    // Collision flags
    BODYFLAG_STATIC_OBJECT: 1,
    BODYFLAG_KINEMATIC_OBJECT: 2,
    BODYFLAG_NORESPONSE_OBJECT: 4,

    // Activation states
    BODYSTATE_ACTIVE_TAG: 1,
    BODYSTATE_ISLAND_SLEEPING: 2,
    BODYSTATE_WANTS_DEACTIVATION: 3,
    BODYSTATE_DISABLE_DEACTIVATION: 4,
    BODYSTATE_DISABLE_SIMULATION: 5,

    // groups
    BODYGROUP_NONE: 0,
    BODYGROUP_DEFAULT: 1,
    BODYGROUP_DYNAMIC: 1,
    BODYGROUP_STATIC: 2,
    BODYGROUP_KINEMATIC: 4,
    BODYGROUP_ENGINE_1: 8,
    BODYGROUP_TRIGGER: 16,
    BODYGROUP_ENGINE_2: 32,
    BODYGROUP_ENGINE_3: 64,
    BODYGROUP_USER_1: 128,
    BODYGROUP_USER_2: 256,
    BODYGROUP_USER_3: 512,
    BODYGROUP_USER_4: 1024,
    BODYGROUP_USER_5: 2048,
    BODYGROUP_USER_6: 4096,
    BODYGROUP_USER_7: 8192,
    BODYGROUP_USER_8: 16384,

    // masks
    BODYMASK_NONE: 0,
    BODYMASK_ALL: 65535,
    BODYMASK_STATIC: 2,
    BODYMASK_NOT_STATIC: 65535 ^ 2,
    BODYMASK_NOT_STATIC_KINEMATIC: 65535 ^ (2 | 4)
});
