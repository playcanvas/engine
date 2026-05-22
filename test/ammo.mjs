import { expect } from 'chai';

// Helpers

/**
 * Assert a number to make sure it is a number and not NaN. Check number to be value if value provided.
 *
 * @param {number} num - Number to assert.
 * @param {number} [val] - Value to expect the number to equal.
 */
function assertNum(num, val) {
    expect(num).to.be.a('number');
    expect(num).to.not.be.NaN;

    if (val !== undefined) {
        expect(num).to.equal(val);
    }
}

/**
 * Assert an array to make sure it is an array. Check value against provided callback if any.
 *
 * @param {*[]} array - Array to assert.
 * @param {Function} [assertValue] - Callback function to run for each value in array.
 */
function assertArray(array, assertValue) {
    expect(array).to.be.an('object');
    assertNum(array.length);

    if (assertValue !== undefined) {
        array.forEach(assertValue);
    }
}

/**
 * Assert an object to be of a certain Ammo type.
 *
 * @param {object} val - The value to assert.
 * @param {string} type - The Ammo type that the value should be of.
 */
function assertAmmoType(val, type) {
    expect(val).to.be.an('object');
    expect(val.__type).to.include(type);
}

/**
 * Whether an object is of a certain Ammo type.
 *
 * @param {object} val - The value to assert.
 * @param {string} type - The Ammo type that the value should be of.
 * @returns {boolean} Whether the value is of a certain Ammo type.
 */
function isOfAmmoType(val, type) {
    return val ? val.__type.indexOf(type) !== -1 : false;
}

/**
 * Assert a Vector 3 to be a vector 3 as well as to match the provided values if any.
 *
 * @param {object} vec - The Vec3 to assert.
 * @param {number} [x] - The expected X value.
 * @param {number} [y] - The expected Y value.
 * @param {number} [z] - The expected Z value.
 */
function assertVec3(vec, x, y, z) {
    assertNum(vec.x, x);
    assertNum(vec.y, y);
    assertNum(vec.z, z);
}

// Stub Ammo

const AmmoTypes = { };

const Ammo = {
    destroy: function (obj) {
        expect(obj).to.be.an('object');
    },
    getPointer: function (type) {
        expect(type).to.be.an('object');

        return type;
    },
    wrapPointer: function (pointer, type) {
        expect(pointer).to.be.an('object');
        expect(type).to.not.equal(undefined);

        if (typeof type === 'function') {
            return type._obj;
        }

        return type;
    },
    castObject: function (origin, target) {
        expect(origin).to.be.an('object');
        expect(target).to.not.equal(undefined);

        if (typeof target === 'function') {
            return target._obj;
        }

        return target;
    },
    addFunction: function (fn, name) {
        expect(fn).to.be.a('function');
        expect(name).to.be.a('string');
        expect(Ammo[name]).to.equal(undefined);

        Ammo[name] = fn;
    }
};

/**
 * Get all types that descend from a searched type.
 *
 * @param {string} type - Searched type name.
 * @param {boolean} [classOnly] - Whether to return only types that have constructor.
 * @returns {string[]} List of type names where type is descendant of searched type.
 */
function allOfAmmoType(type, classOnly = false) {
    return Object.keys(AmmoTypes).filter(t => isOfAmmoType(AmmoTypes[t], type) && (classOnly ? typeof Ammo[t] === 'function' : true));
}

/**
 * Creates a new Ammo type for testing.
 *
 * @param {string} name - The name of this type.
 * @param {object} definition - The definition for this type.
 * @param {object} [parentName] - The parent type name.
 */
function createType(name, definition, parentName) {
    const obj = parentName ? {
        ...AmmoTypes[parentName],
        ...definition
    } : definition;

    if (obj.__type) {
        obj.__type.push(name);
    } else {
        obj.__type = [name];
    }

    AmmoTypes[name] = obj;

    if (obj._constructor) {
        const fn = function (...args) {
            obj._constructor(...args);
            return obj;
        };

        fn._obj = obj;

        Ammo[name] = fn;
    } else {
        Ammo[name] = obj;
    }
}

// Linear Math

createType('btVector3', {
    _constructor: (x, y, z) => {
        if (x !== undefined) {
            assertNum(x);
            assertNum(y);
            assertNum(z);
        }
    },

    length: () => 0,
    x: () => 0,
    y: () => 0,
    z: () => 0,

    setX: x => assertNum(x),
    setY: y => assertNum(y),
    setZ: z => assertNum(z),

    setValue: (x, y, z) => {
        assertNum(x);
        assertNum(y);
        assertNum(z);
    },

    normalize: function () { },
    dot: v => assertAmmoType(v, 'btVector3'),

    op_mul: x => assertNum(x),
    op_add: v => assertAmmoType(v, 'btVector3'),
    op_sub: v => assertAmmoType(v, 'btVector3')
});

createType('btVector4', {
    _constructor: (x, y, z, w) => {
        if (x !== undefined) {
            assertNum(x);
            assertNum(y);
            assertNum(z);
            assertNum(w);
        }
    },

    w: () => 0,

    setValue: (x, y, z, w) => {
        assertNum(x);
        assertNum(y);
        assertNum(z);
        assertNum(w);
    },

    dot: v => assertAmmoType(v, 'btVector4'),

    op_mul: x => assertNum(x),
    op_add: v => assertAmmoType(v, 'btVector4'),
    op_sub: v => assertAmmoType(v, 'btVector4')
}, 'btVector3');

createType('btQuadWord', {
    x: () => 0,
    y: () => 0,
    z: () => 0,
    w: () => 0,

    setX: x => assertNum(x),
    setY: y => assertNum(y),
    setZ: z => assertNum(z),
    setW: w => assertNum(w)
});

createType('btQuaternion', {
    _constructor: (x, y, z, w) => {
        if (x !== undefined) {
            assertNum(x);
            assertNum(y);
            assertNum(z);
            assertNum(w);
        }
    },

    setValue: (x, y, z, w) => {
        assertNum(x);
        assertNum(y);
        assertNum(z);
        assertNum(w);
    },
    setEulerZYX: (x, y, z, w) => {
        assertNum(x);
        assertNum(y);
        assertNum(z);
        assertNum(w);
    },

    normalize: function () { }
}, 'btQuadWord');

createType('btMatrix3x3', {
    setEulerZYX: (x, y, z) => {
        assertNum(x);
        assertNum(y);
        assertNum(z);
    },
    getRotation: q => assertAmmoType(q, 'btQuaternion'),
    getRow: (y) => {
        assertNum(y);

        return AmmoTypes.btVector3;
    }
});

createType('btTransform', {
    _constructor: (q, v) => {
        if (q !== undefined) {
            assertAmmoType(q, 'btQuaternion');
            assertAmmoType(v, 'btVector3');
        }

        return AmmoTypes.btTransform;
    },

    setIdentity: function () { },
    setOrigin: origin => assertAmmoType(origin, 'btVector3'),
    setRotation: rotation => assertAmmoType(rotation, 'btQuaternion'),
    getOrigin: () => AmmoTypes.btVector3,
    getRotation: () => AmmoTypes.btQuaternion,
    getBasis: () => AmmoTypes.btMatrix3x3,
    setFromOpenGLMatrix: m => expect(m).to.be.an('object')
});

createType('btMotionState', {
    getWorldTransform: worldTrans => assertAmmoType(worldTrans, 'btTransform'),
    setWorldTransform: worldTrans => assertAmmoType(worldTrans, 'btTransform')
});

createType('btDefaultMotionState', {
    _constructor: (startTrans, centerOfMassOffset) => {
        if (startTrans !== undefined) {
            assertAmmoType(startTrans, 'btTransform');
        }

        if (centerOfMassOffset !== undefined) {
            assertAmmoType(centerOfMassOffset, 'btTransform');
        }
    },

    m_graphicsWorldTrans: AmmoTypes.btMotionState
}, 'btMotionState');

// Collision

createType('VoidPtr', { });

createType('btCollisionShape', {
    setLocalScaling: scaling => assertAmmoType(scaling, 'btVector3'),
    calculateLocalInertia: (mass, inertia) => {
        assertNum(mass);
        assertAmmoType(inertia, 'btVector3');
    },
    setMargin: margin => assertNum(margin),
    getMargin: () => 0
});

createType('btCollisionObject', {
    setAnisotropicFriction: function (anisotropicFriction, frictionMode) {
        assertAmmoType(anisotropicFriction, 'btVector3');
        assertNum(frictionMode);
    },
    getCollisionShape: () => AmmoTypes.btCollisionShape,
    setContactProcessingThreshold: contactProcessingThreshold => assertNum(contactProcessingThreshold),
    setActivationState: newState => assertNum(newState),
    forceActivationState: newState => assertNum(newState),
    activate: function (forceActivation) {
        if (forceActivation !== undefined) {
            expect(forceActivation).to.be.a('boolean');
        }
    },
    isActive: () => true,
    isKinematicObject: () => true,
    setRestitution: rest => assertNum(rest),
    setFriction: frict => assertNum(frict),
    setRollingFriction: frict => assertNum(frict),
    getWorldTransform: () => AmmoTypes.btTransform,
    getCollisionFlags: () => 0,
    setCollisionFlags: flags => assertNum(flags),
    setWorldTransform: worldTrans => assertAmmoType(worldTrans, 'btTransform'),
    setCollisionShape: collisionShape => assertAmmoType(collisionShape, 'btCollisionShape'),
    setCcdMotionThreshold: ccdMotionThreshold => assertNum(ccdMotionThreshold),
    setCcdSweptSphereRadius: radius => assertNum(radius),
    getUserIndex: () => 0,
    setUserIndex: index => assertNum(index),
    getUserPointer: () => AmmoTypes.VoidPtr,
    setUserPointer: userPointer => assertAmmoType(userPointer, 'VoidPtr')
});

createType('btCollisionObjectWrapper', { });

createType('RayResultCallback', {
    hasHit: () => true,

    m_collisionFilterGroup: 0,
    m_collisionFilterMask: 0,
    m_collisionObject: AmmoTypes.btCollisionObject
});

createType('ClosestRayResultCallback', {
    _constructor: (from, to) => {
        assertAmmoType(from, 'btVector3');
        assertAmmoType(to, 'btVector3');
    },

    m_rayFromWorld: AmmoTypes.btVector3,
    m_rayToWorld: AmmoTypes.btVector3,
    m_hitNormalWorld: AmmoTypes.btVector3,
    m_hitPointWorld: AmmoTypes.btVector3
}, 'RayResultCallback');

createType('btManifoldPoint', {
    getPositionWorldOnA: () => AmmoTypes.btVector3,
    getPositionWorldOnB: () => AmmoTypes.btVector3,
    getAppliedImpulse: () => 0,
    getDistance: () => 0,

    m_localPointA: AmmoTypes.btVector3,
    m_localPointB: AmmoTypes.btVector3,
    m_positionWorldOnB: AmmoTypes.btVector3,
    m_positionWorldOnA: AmmoTypes.btVector3,
    m_normalWorldOnB: AmmoTypes.btVector3
});

createType('ContactResultCallback', {
    addSingleResult: (cp, colObj0Wrap, partId0, index0, colObj1Wrap, partId1, index1) => {
        assertAmmoType(cp, 'btManifoldPoint');
        assertAmmoType(colObj0Wrap, 'btCollisionObjectWrapper');
        assertNum(partId0);
        assertNum(index0);
        assertAmmoType(colObj1Wrap, 'btCollisionObjectWrapper');
        assertNum(partId1);
        assertNum(index1);

        return 1;
    }
});

createType('ConcreteContactResultCallback', {
    _constructor: () => { },

    addSingleResult: (cp, colObj0Wrap, partId0, index0, colObj1Wrap, partId1, index1) => {
        assertAmmoType(cp, 'btManifoldPoint');
        assertAmmoType(colObj0Wrap, 'btCollisionObjectWrapper');
        assertNum(partId0);
        assertNum(index0);
        assertAmmoType(colObj1Wrap, 'btCollisionObjectWrapper');
        assertNum(partId1);
        assertNum(index1);

        return 1;
    }
});

createType('LocalShapeInfo', {
    m_shapePart: 0,
    m_triangleIndex: 0
});

createType('LocalConvexResult', {
    _constructor: (hitCollisionObject, localShapeInfo, hitNormalLocal, hitPointLocal, hitFraction) => {
        assertAmmoType(hitCollisionObject, 'btCollisionObject');
        assertAmmoType(localShapeInfo, 'LocalShapeInfo');
        assertAmmoType(hitNormalLocal, 'btVector3');
        assertAmmoType(hitPointLocal, 'btVector3');
        assertNum(hitFraction);
    },

    m_hitCollisionObject: AmmoTypes.btCollisionObject,
    m_localShapeInfo: AmmoTypes.LocalShapeInfo,
    m_hitNormalLocal: AmmoTypes.btVector3,
    m_hitPointLocal: AmmoTypes.btVector3,
    m_hitFraction: 0
});

createType('ConvexResultCallback', {
    hasHit: () => true,
    m_collisionFilterGroup: 0,
    m_collisionFilterMask: 0,
    m_closestHitFraction: 0
});

createType('ClosestConvexResultCallback', {
    _constructor: (convexFromWorld, convexToWorld) => {
        assertAmmoType(convexFromWorld, 'btVector3');
        assertAmmoType(convexToWorld, 'btVector3');
    },

    m_convexFromWorld: AmmoTypes.btVector3,
    m_convexToWorld: AmmoTypes.btVector3,
    m_hitNormalWorld: AmmoTypes.btVector3,
    m_hitPointWorld: AmmoTypes.btVector3
}, 'ConvexResultCallback');

createType('btConvexShape', { }, 'btCollisionShape');

createType('btConvexTriangleMeshShape', {
    _constructor: (meshInterface, calcAabb) => {
        assertAmmoType(meshInterface, 'btStridingMeshInterface');

        if (calcAabb !== undefined) {
            expect(calcAabb).to.be.a('boolean');
        }
    }
}, 'btConvexShape');

createType('btBoxShape', {
    _constructor: (boxHalfExtents) => {
        assertAmmoType(boxHalfExtents, 'btVector3');
    },

    setMargin: margin => assertNum(margin),
    getMargin: () => 0
}, 'btCollisionShape');

createType('btCapsuleShape', {
    _constructor: (radius, height) => {
        assertNum(radius);
        assertNum(height);
    },

    setMargin: margin => assertNum(margin),
    getMargin: () => 0
}, 'btCollisionShape');

createType('btCapsuleShapeX', {
    _constructor: (radius, height) => {
        assertNum(radius);
        assertNum(height);
    },

    setMargin: margin => assertNum(margin),
    getMargin: () => 0
}, 'btCapsuleShape');

createType('btCapsuleShapeZ', {
    _constructor: (radius, height) => {
        assertNum(radius);
        assertNum(height);
    },

    setMargin: margin => assertNum(margin),
    getMargin: () => 0
}, 'btCapsuleShape');

createType('btCylinderShape', {
    _constructor: (halfExtents) => {
        assertAmmoType(halfExtents, 'btVector3');
    },

    setMargin: margin => assertNum(margin),
    getMargin: () => 0
}, 'btCollisionShape');

createType('btCylinderShapeX', {
    _constructor: (halfExtents) => {
        assertAmmoType(halfExtents, 'btVector3');
    },

    setMargin: margin => assertNum(margin),
    getMargin: () => 0
}, 'btCylinderShape');

createType('btCylinderShapeZ', {
    _constructor: (halfExtents) => {
        assertAmmoType(halfExtents, 'btVector3');
    },

    setMargin: margin => assertNum(margin),
    getMargin: () => 0
}, 'btCylinderShape');

createType('btSphereShape', {
    _constructor: (radius) => {
        assertNum(radius);
    },

    setMargin: margin => assertNum(margin),
    getMargin: () => 0
}, 'btCollisionShape');

createType('btConeShape', {
    _constructor: (radius, height) => {
        assertNum(radius);
        assertNum(height);
    },

    setMargin: margin => assertNum(margin),
    getMargin: () => 0
}, 'btCollisionShape');

createType('btConeShapeX', {
    _constructor: (radius, height) => {
        assertNum(radius);
        assertNum(height);
    },

    setMargin: margin => assertNum(margin),
    getMargin: () => 0
}, 'btConeShape');

createType('btConeShapeZ', {
    _constructor: (radius, height) => {
        assertNum(radius);
        assertNum(height);
    },

    setMargin: margin => assertNum(margin),
    getMargin: () => 0
}, 'btConeShape');

createType('btConvexHullShape', {
    _constructor: () => { },

    addPoint: (point, recalculateLocalAABB) => {
        assertAmmoType(point, 'btVector3');

        if (recalculateLocalAABB !== undefined) {
            expect(recalculateLocalAABB).to.be.a('boolean');
        }
    },
    setMargin: margin => assertNum(margin),
    getMargin: () => 0
}, 'btCollisionShape');

createType('btCompoundShape', {
    _constructor: (enableDynamicAabbTree) => {
        if (enableDynamicAabbTree !== undefined) {
            expect(enableDynamicAabbTree).to.be.a('boolean');
        }
    },

    addChildShape: (localTransform, shape) => {
        assertAmmoType(localTransform, 'btTransform');
        assertAmmoType(shape, 'btCollisionShape');
    },
    removeChildShapeByIndex: childShapeindex => assertNum(childShapeindex),
    getNumChildShapes: () => 1,
    getChildShape: (index) => {
        assertNum(index);

        return AmmoTypes.btCollisionShape;
    },
    setMargin: margin => assertNum(margin),
    getMargin: () => 0
}, 'btCollisionShape');

createType('btStridingMeshInterface', { });

createType('btTriangleMesh', {
    _constructor: (use32bitIndices, use4componentVertices) => {
        if (use32bitIndices !== undefined) {
            expect(use32bitIndices).to.be.a('boolean');
        }

        if (use4componentVertices !== undefined) {
            expect(use4componentVertices).to.be.a('boolean');
        }
    },

    addTriangle: (vertex0, vertex1, vertex2, removeDuplicateVertices) => {
        assertAmmoType(vertex0, 'btVector3');
        assertAmmoType(vertex1, 'btVector3');
        assertAmmoType(vertex2, 'btVector3');

        if (removeDuplicateVertices !== undefined) {
            expect(removeDuplicateVertices).to.be.a('boolean');
        }
    }
}, 'btStridingMeshInterface');

const PHY_ScalarType = {
    PHY_FLOAT: 'PHY_FLOAT',
    PHY_DOUBLE: 'PHY_DOUBLE',
    PHY_INTEGER: 'PHY_INTEGER',
    PHY_SHORT: 'PHY_SHORT',
    PHY_FIXEDPOINT88: 'PHY_FIXEDPOINT88',
    PHY_UCHAR: 'PHY_UCHAR'
};

createType('btConcaveShape', { }, 'btCollisionShape');

createType('btStaticPlaneShape', {
    _constructor: (planeNormal, planeConstant) => {
        assertAmmoType(planeNormal, 'btVector3');
        assertNum(planeConstant);
    }
}, 'btConcaveShape');

createType('btTriangleMeshShape', { }, 'btConcaveShape');

createType('btBvhTriangleMeshShape', {
    _constructor: (meshInterface, useQuantizedAabbCompression, buildBvh) => {
        assertAmmoType(meshInterface, 'btStridingMeshInterface');
        expect(useQuantizedAabbCompression).to.be.a('boolean');

        if (buildBvh !== undefined) {
            expect(buildBvh).to.be.a('boolean');
        }
    }
}, 'btTriangleMeshShape');

createType('btHeightfieldTerrainShape', {
    _constructor: (heightStickWidth, heightStickLength, heightfieldData, heightScale, minHeight, maxHeight, upAxis, hdt, flipQuadEdges) => {
        assertNum(heightStickWidth);
        assertNum(heightStickLength);
        assertAmmoType(heightfieldData, 'VoidPtr');
        assertNum(heightScale);
        assertNum(minHeight);
        assertNum(maxHeight);
        assertNum(upAxis);
        expect(hdt).to.be.oneOf(Object.values(PHY_ScalarType));
        expect(flipQuadEdges).to.be.a('boolean');
    },

    setMargin: margin => assertNum(margin),
    getMargin: () => 0
}, 'btConcaveShape');

createType('btDefaultCollisionConstructionInfo', {
    _constructor: () => { }
});

createType('btCollisionConfiguration', { });

createType('btDefaultCollisionConfiguration', {
    _constructor: (info) => {
        if (info !== undefined) {
            assertAmmoType(info, 'btDefaultCollisionConstructionInfo');
        }
    }
}, 'btCollisionConfiguration');

createType('btPersistentManifold', {
    _constructor: () => { },
    getBody0: () => AmmoTypes.btCollisionObject,
    getBody1: () => AmmoTypes.btCollisionObject,
    getNumContacts: () => 1,
    getContactPoint: (index) => {
        assertNum(index);

        return AmmoTypes.btManifoldPoint;
    }
});

createType('btDispatcher', {
    getNumManifolds: () => 1,
    getManifoldByIndexInternal: (index) => {
        assertNum(index);

        return AmmoTypes.btPersistentManifold;
    }
});

createType('btCollisionDispatcher', {
    _constructor: (conf) => {
        assertAmmoType(conf, 'btDefaultCollisionConfiguration');
    }
}, 'btDispatcher');

createType('btOverlappingPairCallback', { });

createType('btOverlappingPairCache', {
    setInternalGhostPairCallback: ghostPairCallback => assertAmmoType(ghostPairCallback, 'btOverlappingPairCallback')
});

createType('btAxisSweep3', {
    _constructor: (worldAabbMin, worldAabbMax, maxHandles, pairCache, disableRaycastAccelerator) => {
        assertAmmoType(worldAabbMin, 'btVector3');
        assertAmmoType(worldAabbMax, 'btVector3');

        if (maxHandles !== undefined) {
            assertNum(maxHandles);
        }

        if (pairCache !== undefined) {
            assertAmmoType(pairCache, 'btOverlappingPairCache');
        }

        if (disableRaycastAccelerator !== undefined) {
            expect(disableRaycastAccelerator).to.be.a('boolean');
        }
    }
});

createType('btBroadphaseInterface', { });

createType('btDbvtBroadphase', {
    _constructor: () => { }
}, 'btBroadphaseInterface');

// Dynamics

createType('btRigidBodyConstructionInfo', {
    _constructor: (mass, motionState, collisionShape, localInertia) => {
        assertNum(mass);
        assertAmmoType(motionState, 'btMotionState');
        assertAmmoType(collisionShape, 'btCollisionShape');

        if (localInertia !== undefined) {
            assertAmmoType(localInertia, 'btVector3');
        }
    },

    m_linearDamping: 0,
    m_angularDamping: 0,
    m_friction: 0,
    m_rollingFriction: 0,
    m_restitution: 0,
    m_linearSleepingThreshold: 0,
    m_angularSleepingThreshold: 0,
    m_additionalDamping: false,
    m_additionalDampingFactor: 0,
    m_additionalLinearDampingThresholdSqr: 0,
    m_additionalAngularDampingThresholdSqr: 0,
    m_additionalAngularDampingFactor: 0
});

createType('btRigidBody', {
    _constructor: (constructionInfo) => {
        assertAmmoType(constructionInfo, 'btRigidBodyConstructionInfo');
    },

    getCenterOfMassTransform: () => AmmoTypes.btTransform,
    setCenterOfMassTransform: xform => assertAmmoType(xform, 'btTransform'),
    setSleepingThresholds: (linear, angular) => {
        assertNum(linear);
        assertNum(angular);
    },
    setDamping: (lin_damping, ang_damping) => {
        assertNum(lin_damping);
        assertNum(ang_damping);
    },
    setMassProps: (mass, inertia) => {
        assertNum(mass);
        assertAmmoType(inertia, 'btVector3');
    },
    setLinearFactor: linearFactor => assertAmmoType(linearFactor, 'btVector3'),
    applyTorque: torque => assertAmmoType(torque, 'btVector3'),
    applyLocalTorque: torque => assertAmmoType(torque, 'btVector3'),
    applyForce: (force, rel_pos) => {
        assertAmmoType(force, 'btVector3');
        assertAmmoType(rel_pos, 'btVector3');
    },
    applyCentralForce: force => assertAmmoType(force, 'btVector3'),
    applyCentralLocalForce: force => assertAmmoType(force, 'btVector3'),
    applyTorqueImpulse: torque => assertAmmoType(torque, 'btVector3'),
    applyImpulse: (impulse, rel_pos) => {
        assertAmmoType(impulse, 'btVector3');
        assertAmmoType(rel_pos, 'btVector3');
    },
    applyCentralImpulse: impulse => assertAmmoType(impulse, 'btVector3'),
    updateInertiaTensor: function () { },
    getLinearVelocity: () => AmmoTypes.btVector3,
    getAngularVelocity: () => AmmoTypes.btVector3,
    setLinearVelocity: lin_vel => assertAmmoType(lin_vel, 'btVector3'),
    setAngularVelocity: ang_vel => assertAmmoType(ang_vel, 'btVector3'),
    getMotionState: () => AmmoTypes.btMotionState,
    setMotionState: motionState => assertAmmoType(motionState, 'btMotionState'),
    setAngularFactor: angularFactor => assertAmmoType(angularFactor, 'btVector3'),
    upcast: (colObj) => {
        assertAmmoType(colObj, 'btCollisionObject');

        return AmmoTypes.btRigidBody;
    }
}, 'btCollisionObject');

createType('btConstraintSetting', {
    _constructor: () => { },

    m_tau: 0,
    m_damping: 0,
    m_impulseClamp: 0
});

createType('btTypedConstraint', {
    getBreakingImpulseThreshold: () => 0,
    setBreakingImpulseThreshold: threshold => assertNum(threshold)
});

createType('btPoint2PointConstraint', {
    _constructor: (...args) => {
        if (args.length === 2) {
            assertAmmoType(args[0], 'btRigidBody');
            assertAmmoType(args[1], 'btVector3');
        } else {
            assertAmmoType(args[0], 'btRigidBody');
            assertAmmoType(args[1], 'btRigidBody');
            assertAmmoType(args[2], 'btVector3');
            assertAmmoType(args[3], 'btVector3');
        }
    },

    setPivotA: pivotA => assertAmmoType(pivotA, 'btVector3'),
    setPivotB: pivotB => assertAmmoType(pivotB, 'btVector3'),
    getPivotInA: () => AmmoTypes.btVector3,
    getPivotInB: () => AmmoTypes.btVector3,

    m_setting: AmmoTypes.btConstraintSetting
}, 'btTypedConstraint');

createType('btGeneric6DofConstraint', {
    _constructor: (...args) => {
        if (args.length === 3) {
            assertAmmoType(args[0], 'btRigidBody');
            assertAmmoType(args[1], 'btTransform');
            expect(args[2]).to.be.a('boolean');
        } else {
            assertAmmoType(args[0], 'btRigidBody');
            assertAmmoType(args[1], 'btRigidBody');
            assertAmmoType(args[2], 'btTransform');
            assertAmmoType(args[3], 'btTransform');
            expect(args[4]).to.be.a('boolean');
        }
    },

    setLinearLowerLimit: linearLower => assertAmmoType(linearLower, 'btVector3'),
    setLinearUpperLimit: linearUpper => assertAmmoType(linearUpper, 'btVector3'),
    setAngularLowerLimit: angularLower => assertAmmoType(angularLower, 'btVector3'),
    setAngularUpperLimit: angularUpper => assertAmmoType(angularUpper, 'btVector3')
}, 'btTypedConstraint');

createType('btGeneric6DofSpringConstraint', {
    _constructor: (...args) => {
        if (args.length === 3) {
            assertAmmoType(args[0], 'btRigidBody');
            assertAmmoType(args[1], 'btTransform');
            expect(args[2]).to.be.a('boolean');
        } else {
            assertAmmoType(args[0], 'btRigidBody');
            assertAmmoType(args[1], 'btRigidBody');
            assertAmmoType(args[2], 'btTransform');
            assertAmmoType(args[3], 'btTransform');
            expect(args[4]).to.be.a('boolean');
        }
    },

    enableSpring: (index, onOff) => {
        assertNum(index);
        expect(onOff).to.be.a('boolean');
    },
    setStiffness: (index, stiffness) => {
        assertNum(index);
        assertNum(stiffness);
    },
    setDamping: (index, damping) => {
        assertNum(index);
        assertNum(damping);
    }
}, 'btGeneric6DofConstraint');

createType('btConstraintSolver', { });

createType('btSequentialImpulseConstraintSolver', {
    _constructor: () => { }
}, 'btConstraintSolver');

createType('btConeTwistConstraint', {
    _constructor: (...args) => {
        if (args.length === 2) {
            assertAmmoType(args[0], 'btRigidBody');
            assertAmmoType(args[1], 'btTransform');
        } else {
            assertAmmoType(args[0], 'btRigidBody');
            assertAmmoType(args[1], 'btRigidBody');
            assertAmmoType(args[2], 'btTransform');
            assertAmmoType(args[3], 'btTransform');
        }
    },

    setLimit: (limitIndex, limitValue) => {
        assertNum(limitIndex);
        assertNum(limitValue);
    },
    setAngularOnly: angularOnly => expect(angularOnly).to.be.a('boolean'),
    setDamping: damping => assertNum(damping),
    enableMotor: b => expect(b).to.be.a('boolean'),
    setMaxMotorImpulse: maxMotorImpulse => assertNum(maxMotorImpulse),
    setMaxMotorImpulseNormalized: maxMotorImpulse => assertNum(maxMotorImpulse),
    setMotorTarget: q => assertAmmoType(q, 'btQuaternion'),
    setMotorTargetInConstraintSpace: q => assertAmmoType(q, 'btQuaternion')
}, 'btTypedConstraint');

createType('btHingeConstraint', {
    _constructor: (...args) => {
        if (args.length === 3) {
            assertAmmoType(args[0], 'btRigidBody');
            assertAmmoType(args[1], 'btTransform');
            expect(args[2]).to.be.a('boolean');
        } else if (args.length === 5) {
            assertAmmoType(args[0], 'btRigidBody');
            assertAmmoType(args[1], 'btRigidBody');
            assertAmmoType(args[2], 'btTransform');
            assertAmmoType(args[3], 'btTransform');
            expect(args[4]).to.be.a('boolean');
        } else {
            assertAmmoType(args[0], 'btRigidBody');
            assertAmmoType(args[1], 'btRigidBody');
            assertAmmoType(args[2], 'btVector3');
            assertAmmoType(args[3], 'btVector3');
            assertAmmoType(args[4], 'btVector3');
            assertAmmoType(args[5], 'btVector3');
            expect(args[6]).to.be.a('boolean');
        }
    },

    setLimit: (low, high, softness, biasFactor, relaxationFactor) => {
        assertNum(low);
        assertNum(high);
        assertNum(softness);
        assertNum(biasFactor);

        if (relaxationFactor !== undefined) {
            assertNum(relaxationFactor);
        }
    },
    enableAngularMotor: (enableMotor, targetVelocity, maxMotorImpulse) => {
        expect(enableMotor).to.be.a('boolean');
        assertNum(targetVelocity);
        assertNum(maxMotorImpulse);
    },
    setAngularOnly: angularOnly => expect(angularOnly).to.be.a('boolean'),

    enableMotor: enableMotor => expect(enableMotor).to.be.a('boolean'),
    setMaxMotorImpulse: maxMotorImpulse => assertNum(maxMotorImpulse),
    setMotorTarget: (targetAngle, dt) => {
        assertNum(targetAngle);
        assertNum(dt);
    }
}, 'btTypedConstraint');

createType('btSliderConstraint', {
    _constructor: (...args) => {
        if (args.length === 3) {
            assertAmmoType(args[0], 'btRigidBody');
            assertAmmoType(args[1], 'btTransform');
            expect(args[2]).to.be.a('boolean');
        } else {
            assertAmmoType(args[0], 'btRigidBody');
            assertAmmoType(args[1], 'btRigidBody');
            assertAmmoType(args[2], 'btTransform');
            assertAmmoType(args[3], 'btTransform');
            expect(args[4]).to.be.a('boolean');
        }
    },

    setLowerLinLimit: lowerLimit => assertNum(lowerLimit),
    setUpperLinLimit: upperLimit => assertNum(upperLimit),
    setLowerAngLimit: lowerAngLimit => assertNum(lowerAngLimit),
    setUpperAngLimit: upperAngLimit => assertNum(upperAngLimit)
}, 'btTypedConstraint');

createType('btDispatcherInfo', {
    m_timeStep: 0,
    m_stepCount: 0,
    m_dispatchFunc: 0,
    m_timeOfImpact: 0,
    m_useContinuous: true,
    m_enableSatConvex: true,
    m_enableSPU: true,
    m_useEpa: true,
    m_allowedCcdPenetration: 0,
    m_useConvexConservativeDistanceUtil: true,
    m_convexConservativeDistanceThreshold: 0
});

createType('btCollisionWorld', {
    getDispatcher: () => AmmoTypes.btDispatcher,
    rayTest: (rayFromWorld, rayToWorld, resultCallback) => {
        assertAmmoType(rayFromWorld, 'btVector3');
        assertAmmoType(rayToWorld, 'btVector3');
        assertAmmoType(resultCallback, 'RayResultCallback');
    },
    getPairCache: () => AmmoTypes.btOverlappingPairCache,
    getDispatchInfo: () => AmmoTypes.btDispatcherInfo,
    addCollisionObject: (collisionObject, collisionFilterGroup, collisionFilterMask) => {
        assertAmmoType(collisionObject, 'btCollisionObject');

        if (collisionFilterGroup !== undefined) {
            assertNum(collisionFilterGroup);
        }

        if (collisionFilterMask !== undefined) {
            assertNum(collisionFilterMask);
        }
    },
    getBroadphase: () => AmmoTypes.btBroadphaseInterface,
    convexSweepTest: (castShape, from, to, resultCallback, allowedCcdPenetration) => {
        assertAmmoType(castShape, 'btConvexShape');
        assertAmmoType(from, 'btTransform');
        assertAmmoType(to, 'btTransform');
        assertAmmoType(resultCallback, 'ConvexResultCallback');
        assertNum(allowedCcdPenetration);
    },
    contactPairTest: (colObjA, colObjB, resultCallback) => {
        assertAmmoType(colObjA, 'btCollisionObject');
        assertAmmoType(colObjB, 'btCollisionObject');
        assertAmmoType(resultCallback, 'ContactResultCallback');
    },
    contactTest: (colObj, resultCallback) => {
        assertAmmoType(colObj, 'btCollisionObject');
        assertAmmoType(resultCallback, 'ContactResultCallback');
    }
});

createType('btContactSolverInfo', {
    m_splitImpulse: false,
    m_splitImpulsePenetrationThreshold: 0
});

createType('btDynamicsWorld', {
    addAction: action => assertAmmoType(action, 'btActionInterface'),
    removeAction: action => assertAmmoType(action, 'btActionInterface'),
    getSolverInfo: () => AmmoTypes.btContactSolverInfo
}, 'btCollisionWorld');

createType('btDiscreteDynamicsWorld', {
    _constructor: (dispatcher, pairCache, constraintSolver, collisionConfiguration) => {
        assertAmmoType(dispatcher, 'btDispatcher');
        assertAmmoType(pairCache, 'btBroadphaseInterface');
        assertAmmoType(constraintSolver, 'btConstraintSolver');
        assertAmmoType(collisionConfiguration, 'btCollisionConfiguration');
    },

    setGravity: gravity => assertAmmoType(gravity, 'btVector3'),
    getGravity: () => AmmoTypes.btVector3,

    addRigidBody: (body, group, mask) => {
        assertAmmoType(body, 'btRigidBody');

        if (group !== undefined) {
            assertNum(group);
            assertNum(mask);
        }
    },
    removeRigidBody: body => assertAmmoType(body, 'btRigidBody'),

    addConstraint: (constraint, disableCollisionsBetweenLinkedBodies) => {
        assertAmmoType(constraint, 'btTypedConstraint');

        if (disableCollisionsBetweenLinkedBodies !== undefined) {
            expect(disableCollisionsBetweenLinkedBodies).to.be.a('boolean');
        }
    },
    removeConstraint: constraint => assertAmmoType(constraint, 'btTypedConstraint'),

    stepSimulation: (timeStep, maxSubSteps, fixedTimeStep) => {
        assertNum(timeStep);

        if (maxSubSteps !== undefined) {
            assertNum(maxSubSteps);
        }

        if (fixedTimeStep !== undefined) {
            assertNum(fixedTimeStep);
        }
    }
}, 'btDynamicsWorld');

createType('btVehicleTuning', {
    _constructor: () => { },

    m_suspensionStiffness: 0,
    m_suspensionCompression: 0,
    m_suspensionDamping: 0,
    m_maxSuspensionTravelCm: 0,
    m_frictionSlip: 0,
    m_maxSuspensionForce: 0
});

createType('btVehicleRaycasterResult', {
    m_hitPointInWorld: AmmoTypes.btVector3,
    m_hitNormalInWorld: AmmoTypes.btVector3,
    m_distFraction: 0
});

createType('btVehicleRaycaster', {
    castRay: (from, to, result) => {
        assertAmmoType(from, 'btVector3');
        assertAmmoType(to, 'btVector3');
        assertAmmoType(result, 'btVehicleRaycasterResult');
    }
});

createType('btDefaultVehicleRaycaster', {
    _constructor: (world) => {
        assertAmmoType(world, 'btDynamicsWorld');
    }
}, 'btVehicleRaycaster');

createType('RaycastInfo', {
    m_contactNormalWS: AmmoTypes.btVector3,
    m_contactPointWS: AmmoTypes.btVector3,
    m_suspensionLength: 0,
    m_hardPointWS: AmmoTypes.btVector3,
    m_wheelDirectionWS: AmmoTypes.btVector3,
    m_wheelAxleWS: AmmoTypes.btVector3,
    m_isInContact: true,
    m_groundObject: null
});

createType('btWheelInfoConstructionInfo', {
    m_chassisConnectionCS: AmmoTypes.btVector3,
    m_wheelDirectionCS: AmmoTypes.btVector3,
    m_wheelAxleCS: AmmoTypes.btVector3,
    m_suspensionRestLength: 0,
    m_maxSuspensionTravelCm: 0,
    m_wheelRadius: 0,
    m_suspensionStiffness: 0,
    m_wheelsDampingCompression: 0,
    m_wheelsDampingRelaxation: 0,
    m_frictionSlip: 0,
    m_maxSuspensionForce: 0,
    m_bIsFrontWheel: false
});

createType('btWheelInfo', {
    _constructor: (ci) => {
        assertAmmoType(ci, 'btWheelInfoConstructionInfo');
    },

    m_suspensionStiffness: 0,
    m_frictionSlip: 0,
    m_engineForce: 0,
    m_rollInfluence: 0,
    m_suspensionRestLength1: 0,
    m_wheelsRadius: 0,
    m_wheelsDampingCompression: 0,
    m_wheelsDampingRelaxation: 0,
    m_steering: 0,
    m_maxSuspensionForce: 0,
    m_maxSuspensionTravelCm: 0,
    m_wheelsSuspensionForce: 0,
    m_bIsFrontWheel: false,
    m_raycastInfo: AmmoTypes.RaycastInfo,
    m_chassisConnectionPointCS: AmmoTypes.btVector3,
    getSuspensionRestLength: () => 0,
    updateWheel: (chassis, raycastInfo) => {
        assertAmmoType(chassis, 'btRigidBody');
        assertAmmoType(raycastInfo, 'RaycastInfo');
    },
    m_worldTransform: AmmoTypes.btTransform,
    m_wheelDirectionCS: AmmoTypes.btVector3,
    m_wheelAxleCS: AmmoTypes.btVector3,
    m_rotation: 0,
    m_deltaRotation: 0,
    m_brake: 0,
    m_clippedInvContactDotSuspension: 0,
    m_suspensionRelativeVelocity: 0,
    m_skidInfo: 0
});

createType('btActionInterface', {
    updateAction: (collisionWorld, deltaTimeStep) => {
        assertAmmoType(collisionWorld, 'btCollisionWorld');
        assertNum(deltaTimeStep);
    }
});

createType('btGhostObject', {
    _constructor: () => { },

    getNumOverlappingObjects: () => 1,
    getOverlappingObject: (index) => {
        assertNum(index);

        return AmmoTypes.btCollisionObject;
    }
}, 'btCollisionObject');

createType('btPairCachingGhostObject', {
    _constructor: () => { }
}, 'btGhostObject');

createType('btKinematicCharacterController', {
    _constructor: (ghostObject, convexShape, stepHeight, upAxis) => {
        assertAmmoType(ghostObject, 'btPairCachingGhostObject');
        assertAmmoType(convexShape, 'btConvexShape');
        assertNum(stepHeight);

        if (upAxis !== undefined) {
            assertNum(upAxis);
        }
    },

    setUpAxis: axis => assertNum(axis),
    setWalkDirection: walkDirection => assertAmmoType(walkDirection, 'btVector3'),
    setVelocityForTimeInterval: (velocity, timeInterval) => {
        assertAmmoType(velocity, 'btVector3');
        assertNum(timeInterval);
    },
    warp: origin => assertAmmoType(origin, 'btVector3'),
    preStep: collisionWorld => assertAmmoType(collisionWorld, 'btCollisionWorld'),
    playerStep: (collisionWorld, dt) => {
        assertAmmoType(collisionWorld, 'btCollisionWorld');
        assertNum(dt);
    },
    setFallSpeed: fallSpeed => assertNum(fallSpeed),
    setJumpSpeed: jumpSpeed => assertNum(jumpSpeed),
    setMaxJumpHeight: maxJumpHeight => assertNum(maxJumpHeight),
    canJump: () => true,
    jump: function () { },
    setGravity: gravity => assertNum(gravity),
    getGravity: () => 0,
    setMaxSlope: slopeRadians => assertNum(slopeRadians),
    getMaxSlope: () => 0,
    getGhostObject: () => AmmoTypes.btPairCachingGhostObject,
    setUseGhostSweepTest: useGhostObjectSweepTest => expect(useGhostObjectSweepTest).to.be.a('boolean'),
    onGround: () => true
}, 'btActionInterface');

createType('btRaycastVehicle', {
    _constructor: (tuning, chassis, raycaster) => {
        assertAmmoType(tuning, 'btVehicleTuning');
        assertAmmoType(chassis, 'btRigidBody');
        assertAmmoType(raycaster, 'btVehicleRaycaster');
    },

    applyEngineForce: (force, wheel) => {
        assertNum(force);
        assertNum(wheel);
    },
    setSteeringValue: (steering, wheel) => {
        assertNum(steering);
        assertNum(wheel);
    },
    getWheelTransformWS: (wheelIndex) => {
        assertNum(wheelIndex);

        return AmmoTypes.btTransform;
    },
    updateWheelTransform: (wheelIndex, interpolatedTransform) => {
        assertNum(wheelIndex);
        expect(interpolatedTransform).to.be.a('boolean');
    },
    addWheel: (connectionPointCS0, wheelDirectionCS0, wheelAxleCS, suspensionRestLength, wheelRadius, tuning, isFrontWheel) => {
        assertAmmoType(connectionPointCS0, 'btVector3');
        assertAmmoType(wheelDirectionCS0, 'btVector3');
        assertAmmoType(wheelAxleCS, 'btVector3');
        assertNum(suspensionRestLength);
        assertNum(wheelRadius);
        assertAmmoType(tuning, 'btVehicleTuning');
        expect(isFrontWheel).to.be.a('boolean');

        return AmmoTypes.btWheelInfo;
    },
    getNumWheels: () => 1,
    getRigidBody: () => AmmoTypes.btRigidBody,
    getWheelInfo: (index) => {
        assertNum(index);

        return AmmoTypes.btWheelInfo;
    },
    setBrake: (brake, wheelIndex) => {
        assertNum(brake);
        assertNum(wheelIndex);
    },
    setCoordinateSystem: (rightIndex, upIndex, forwardIndex) => {
        assertNum(rightIndex);
        assertNum(upIndex);
        assertNum(forwardIndex);
    },
    getCurrentSpeedKmHour: () => 0,
    getChassisWorldTransform: () => AmmoTypes.btTransform,
    rayCast: (wheel) => {
        assertAmmoType(wheel, 'btWheelInfo');

        return 0;
    },
    updateVehicle: step => assertNum(step),
    resetSuspension: function () { },
    getSteeringValue: (wheel) => {
        assertNum(wheel);

        return 0;
    },
    updateWheelTransformsWS: (wheel, interpolatedTransform) => {
        assertAmmoType(wheel, 'btWheelInfo');

        if (interpolatedTransform !== undefined) {
            expect(interpolatedTransform).to.be.a('boolean');
        }
    },
    setPitchControl: pitch => assertNum(pitch),
    updateSuspension: deltaTime => assertNum(deltaTime),
    updateFriction: timeStep => assertNum(timeStep),
    getRightAxis: () => 0,
    getUpAxis: () => 0,
    getForwardAxis: () => 0,
    getForwardVector: () => AmmoTypes.btVector3,
    getUserConstraintType: () => 0,
    setUserConstraintType: userConstraintType => assertNum(userConstraintType),
    setUserConstraintId: uid => assertNum(uid),
    getUserConstraintId: () => 0
}, 'btActionInterface');

createType('btGhostPairCallback', {
    _constructor: () => { }
});

// soft bodies

createType('btSoftBodyWorldInfo', {
    _constructor: () => { },

    air_density: 0,
    water_density: 0,
    water_offset: 0,
    m_maxDisplacement: 0,
    water_normal: AmmoTypes.btVector3,
    m_broadphase: AmmoTypes.btBroadphaseInterface,
    m_dispatcher: AmmoTypes.btDispatcher,
    m_gravity: AmmoTypes.btVector3
});

createType('Node', {
    m_x: AmmoTypes.btVector3,
    m_n: AmmoTypes.btVector3
});

createType('tNodeArray', {
    size: () => 1,
    at: (n) => {
        assertNum(n);

        return Node;
    }
});

createType('Material', {
    m_kLST: 0,
    m_kAST: 0,
    m_kVST: 0,
    m_flags: 0
});

createType('tMaterialArray', {
    size: () => 1,
    at: (n) => {
        assertNum(n);

        return AmmoTypes.Material;
    }
});

createType('Config', {
    kVCF: 0,
    kDP: 0,
    kDG: 0,
    kLF: 0,
    kPR: 0,
    kVC: 0,
    kDF: 0,
    kMT: 0,
    kCHR: 0,
    kKHR: 0,
    kSHR: 0,
    kAHR: 0,
    kSRHR_CL: 0,
    kSKHR_CL: 0,
    kSSHR_CL: 0,
    kSR_SPLT_CL: 0,
    kSK_SPLT_CL: 0,
    kSS_SPLT_CL: 0,
    maxvolume: 0,
    timescale: 0,
    viterations: 0,
    piterations: 0,
    diterations: 0,
    citerations: 0,
    collisions: 0
});

createType('btSoftBody', {
    _constructor: (worldInfo, node_count, x, m) => {
        assertAmmoType(worldInfo, 'btSoftBodyWorldInfo');
        assertNum(node_count);
        assertAmmoType(x, 'btVector3');
        assertArray(m, v => assertNum(v));
    },

    m_cfg: AmmoTypes.Config,
    m_nodes: AmmoTypes.tNodeArray,
    m_materials: AmmoTypes.tMaterialArray,

    checkLink: (node0, node1) => {
        assertNum(node0);
        assertNum(node1);

        return true;
    },
    checkFace: (node0, node1, node2) => {
        assertNum(node0);
        assertNum(node1);
        assertNum(node2);

        return true;
    },
    appendMaterial: () => AmmoTypes.Material,
    appendNode: (x, m) => {
        assertAmmoType(x, 'btVector3');
        assertNum(m);
    },
    appendLink: (node0, node1, mat, bcheckexist) => {
        assertNum(node0);
        assertNum(node1);
        assertAmmoType(mat, 'Material');
        expect(bcheckexist).to.be.a('boolean');
    },
    appendFace: (node0, node1, node2, mat) => {
        assertNum(node0);
        assertNum(node1);
        assertNum(node2);
        assertAmmoType(mat, 'Material');
    },
    appendTetra: (node0, node1, node2, node3, mat) => {
        assertNum(node0);
        assertNum(node1);
        assertNum(node2);
        assertNum(node3);
        assertAmmoType(mat, 'Material');
    },
    appendAnchor: (node, body, disableCollisionBetweenLinkedBodies, influence) => {
        assertNum(node);
        assertAmmoType(body, 'btRigidBody');
        expect(disableCollisionBetweenLinkedBodies).to.be.a('boolean');
        assertNum(influence);
    },
    getTotalMass: () => 1,
    setTotalMass: (mass, fromfaces) => {
        assertNum(mass);
        assertNum(fromfaces);
    },
    setMass: (node, mass) => {
        assertNum(node);
        assertNum(mass);
    },
    transform: trs => assertAmmoType(trs, 'btTransform'),
    translate: trs => assertAmmoType(trs, 'btVector3'),
    rotate: rot => assertAmmoType(rot, 'btQuaternion'),
    scale: scl => assertAmmoType(scl, 'btVector3'),
    generateClusters: (k, maxiterations) => {
        assertNum(k);

        if (maxiterations !== undefined) {
            assertNum(maxiterations);
        }

        return 1;
    },
    upcast: (colObj) => {
        assertAmmoType(colObj, 'btCollisionObject');

        return AmmoTypes.btSoftBody;
    }
}, 'btCollisionObject');

createType('btSoftBodyRigidBodyCollisionConfiguration', {
    _constructor: (info) => {
        if (info !== undefined) {
            assertAmmoType(info, 'btDefaultCollisionConstructionInfo');
        }
    }
}, 'btDefaultCollisionConfiguration');

createType('btSoftBodySolver', { });

createType('btDefaultSoftBodySolver', {
    _constructor: () => { }
}, 'btSoftBodySolver');

createType('btSoftBodyArray', {
    size: () => 1,
    at: (n) => {
        assertNum(n);

        return AmmoTypes.btSoftBody;
    }
});

createType('btSoftRigidDynamicsWorld', {
    _constructor: (dispatcher, pairCache, constraintSolver, collisionConfiguration, softBodySolver) => {
        assertAmmoType(dispatcher, 'btDispatcher');
        assertAmmoType(pairCache, 'btBroadphaseInterface');
        assertAmmoType(constraintSolver, 'btConstraintSolver');
        assertAmmoType(collisionConfiguration, 'btCollisionConfiguration');
        assertAmmoType(softBodySolver, 'btSoftBodySolver');
    },

    addSoftBody: (body, collisionFilterGroup, collisionFilterMask) => {
        assertAmmoType(body, 'btSoftBody');
        assertNum(collisionFilterGroup);
        assertNum(collisionFilterMask);
    },
    removeSoftBody: body => assertAmmoType(body, 'btSoftBody'),
    removeCollisionObject: collisionObject => assertAmmoType(collisionObject, 'collisionObject'),

    getWorldInfo: () => AmmoTypes.btSoftBodyWorldInfo,
    getSoftBodyArray: () => AmmoTypes.btSoftBodyArray
}, 'btDiscreteDynamicsWorld');

createType('btSoftBodyHelpers', {
    _constructor: () => { },

    CreateRope: (worldInfo, from, to, res, fixeds) => {
        assertAmmoType(worldInfo, 'btSoftBodyWorldInfo');
        assertAmmoType(from, 'btVector3');
        assertAmmoType(to, 'btVector3');
        assertNum(res);
        assertNum(fixeds);

        return AmmoTypes.btSoftBody;
    },
    CreatePatch: (worldInfo, corner00, corner10, corner01, corner11, resx, resy, fixeds, gendiags) => {
        assertAmmoType(worldInfo, 'btSoftBodyWorldInfo');
        assertAmmoType(corner00, 'btVector3');
        assertAmmoType(corner10, 'btVector3');
        assertAmmoType(corner01, 'btVector3');
        assertAmmoType(corner11, 'btVector3');
        assertNum(resx);
        assertNum(resy);
        assertNum(fixeds);
        expect(gendiags).to.be.a('boolean');

        return AmmoTypes.btSoftBody;
    },
    CreatePatchUV: (worldInfo, corner00, corner10, corner01, corner11, resx, resy, fixeds, gendiags, tex_coords) => {
        assertAmmoType(worldInfo, 'btSoftBodyWorldInfo');
        assertAmmoType(corner00, 'btVector3');
        assertAmmoType(corner10, 'btVector3');
        assertAmmoType(corner01, 'btVector3');
        assertAmmoType(corner11, 'btVector3');
        assertNum(resx);
        assertNum(resy);
        assertNum(fixeds);
        expect(gendiags).to.be.a('boolean');
        assertArray(tex_coords, v => assertNum(v));

        return AmmoTypes.btSoftBody;
    },
    CreateEllipsoid: (worldInfo, center, radius, res) => {
        assertAmmoType(worldInfo, 'btSoftBodyWorldInfo');
        assertAmmoType(center, 'btVector3');
        assertAmmoType(radius, 'btVector3');
        assertNum(res);

        return AmmoTypes.btSoftBody;
    },
    CreateFromTriMesh: (worldInfo, vertices, triangles, ntriangles, randomizeConstraints) => {
        assertAmmoType(worldInfo, 'btSoftBodyWorldInfo');
        assertArray(vertices, v => assertNum(v));
        assertArray(triangles, v => assertNum(v));
        assertNum(ntriangles);
        expect(randomizeConstraints).to.be.a('boolean');

        return AmmoTypes.btSoftBody;
    },
    CreateFromConvexHull: (worldInfo, vertices, nvertices, randomizeConstraints) => {
        assertAmmoType(worldInfo, 'btSoftBodyWorldInfo');
        assertAmmoType(vertices, 'btVector3');
        assertNum(nvertices);
        expect(randomizeConstraints).to.be.a('boolean');

        return AmmoTypes.btSoftBody;
    }
});

export { Ammo, assertNum, assertArray, assertVec3, assertAmmoType, isOfAmmoType, allOfAmmoType };
