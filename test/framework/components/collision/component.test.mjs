import { HTMLCanvasElement } from '@playcanvas/canvas-mock';

import { Application } from '../../../../src/framework/app-base.js';
import { Entity } from '../../../../src/framework/entity.js';
import { Vec3 } from '../../../../src/math/vec3.js';

import { expect } from 'chai';
import sinon from 'sinon';

describe('CollisionComponent', function () {
    /** @type {Application} */
    let app;
    /** @type {Entity} */
    let entity;

    // Helpers

    const assertVec3 = function(vec, a, b, c) {
        expect(vec.x).to.equal(a);
        expect(vec.y).to.equal(b);
        expect(vec.z).to.equal(c);
    }

    const assertNum = function(num, val) {
        expect(num).to.be.a('number');
        expect(num).to.not.be.NaN;
        if (val !== undefined) {
            expect(num).to.equal(val);
        }
    }

    // Stub Ammo

    const btQuaternion = { 
        setValue: (x, y, z, w) => {
            assertNum(x); assertNum(y);
            assertNum(z); assertNum(w);
        }
    };
    const btVector3 = {
        setValue: (x, y, z) => {
            assertNum(x); assertNum(y);
            assertNum(z);
        }
    };
    const btTransform = { 
        setOrigin: btVec => { expect(btVec).to.be.an('object'); },
        setRotation: btQuat => { expect(btQuat).to.be.an('object'); },
    };
    const btShape = { calculateLocalInertia: function () {} };
    const btRigidBody = { 
        setRestitution: num => { assertNum(num); },
        setFriction: num => { assertNum(num); },
        setDamping: (a, b) => { assertNum(a); assertNum(b); },
        setLinearFactor: btVec => { expect(btVec).to.be.an('object'); },
        setAngularFactor: btVec => { expect(btVec).to.be.an('object'); },
        getCollisionFlags: () => { return 0; },
        setCollisionFlags: bit => { assertNum(bit); },
        forceActivationState: bit => { assertNum(bit); }
    };

    // Note: do not use arrow functions in the Ammo root object, since the engine will 
    // not be able to use "new" keyword with them for instantiation
    const Ammo = {
        btVector3: function() { return btVector3; },
        btQuaternion: function() { return btQuaternion; },
        btTransform: function () { return btTransform; },
        
        // shapes are overriden by their respective test cases
        btBoxShape: function () {},
        btSphereShape: function() {},
        btCapsuleShapeX: function() {},
        btCapsuleShape: function() {},
        btCapsuleShapeZ: function() {},
        btCylinderShapeX: function() {},
        btCylinderShape: function() {},
        btCylinderShapeZ: function() {},
        btConeShapeX: function() {},
        btConeShape: function() {},
        btConeShapeZ: function() {},
        btCompoundShape: function() {
            return btShape;
        },
        btDefaultMotionState: function() {},
        btRigidBodyConstructionInfo: function() {},
        btRigidBody: function () { return btRigidBody },
        destroy: function() {},
    };

    // Hooks

    before(function() {
        global.Ammo = Ammo;
    });

    after(function() {
        global.Ammo = undefined;
    });

    beforeEach(function() {
        const canvas = new HTMLCanvasElement(500, 500);
        app = new Application(canvas);
        entity = new Entity();

        // Ignore requests to Rigidbody Component System for destoying our stubbed btRigidBody
        const rigidbody = app.systems.rigidbody;
        sinon.stub(rigidbody, 'removeBody').callsFake(body => {});
        sinon.stub(rigidbody, 'destroyBody').callsFake(body => {});
    });

    afterEach(function() {
        entity.destroy();
        app.destroy();
        sinon.restore();
    });

    // Tests

    it('should initialize with default values when no options provided', function() {
        // Test case specific override
        let shapesCreated = 0;
        sinon.stub(Ammo, 'btBoxShape').callsFake(btVec => {
            shapesCreated++;
            expect(btVec).to.be.an('object');
            return btShape;
        });

        entity.addComponent('collision');
        const component = entity.collision;

        assertVec3(component.halfExtents, 0.5, 0.5, 0.5);
        expect(component.asset).to.be.null;
        expect(component.axis).to.equal(1);
        expect(component.enabled).to.be.true;
        expect(component.height).to.equal(2);
        expect(component.initialized).to.be.true;
        expect(component.model).to.be.an('object');
        expect(component.radius).to.equal(0.5);
        expect(component.render).to.be.null;
        expect(component.renderAsset).to.be.null;
        expect(component.shape).to.be.an('object');
        expect(component.type).to.equal('box');
        expect(entity.trigger).to.be.an('object');
        expect(shapesCreated).to.equal(1);
    });

    it('should describe a box shaped trigger when correct options provided', function() {
        // Test case specific override
        let shapesCreated = 0;
        sinon.stub(Ammo, 'btBoxShape').callsFake(btVec => {
            shapesCreated++;
            expect(btVec).to.be.an('object');
            return btShape;
        });

        entity.addComponent('collision', { type: 'box' });
        const component = entity.collision;

        // Check defualts
        assertVec3(component.halfExtents, 0.5, 0.5, 0.5);
        expect(component.type).to.equal('box');
        expect(entity.trigger).to.be.an('object');

        // Check changing params
        component.halfExtents = new Vec3(1, 2, 3);
        assertVec3(component.halfExtents, 1, 2, 3);

        // Total shapes created 1 for the default + 1 when we changed the half extents
        expect(shapesCreated).to.equal(2);
    });

    it('should describe a sphere shaped trigger when correct options provided', function() {
        // Test case specific override
        let shapesCreated = 0;
        sinon.stub(Ammo, 'btSphereShape').callsFake(radius => {
            shapesCreated++;
            assertNum(radius);
            return btShape;
        });

        entity.addComponent('collision', { type: 'sphere' });
        const component = entity.collision;

        assertNum(component.radius, 0.5);
        expect(component.type).to.equal('sphere');
        expect(entity.trigger).to.be.an('object');

        component.radius = 2;
        assertNum(component.radius, 2);

        // Total shapes created 1 for the default + 1 when we changed the radius
        expect(shapesCreated).to.equal(2);
    });

    it('should describe a capsule shaped trigger when correct options provided', function() {
        // Test case specific override
        const cb = (radius, height) => {
            shapesCreated++;
            assertNum(radius); assertNum(height);
            return btShape;
        }
        let shapesCreated = 0;
        sinon.stub(Ammo, 'btCapsuleShapeX').callsFake(cb);
        sinon.stub(Ammo, 'btCapsuleShape').callsFake(cb);
        sinon.stub(Ammo, 'btCapsuleShapeZ').callsFake(cb);

        entity.addComponent('collision', { type: 'capsule' });
        const component = entity.collision;

        assertNum(component.axis, 1);   // Y
        assertNum(component.radius, 0.5);
        assertNum(component.height, 2);

        expect(component.type).to.equal('capsule');
        expect(entity.trigger).to.be.an('object');

        component.axis = 0;     // X
        component.radius = 2;
        component.height = 4;

        assertNum(component.axis, 0);
        assertNum(component.radius, 2);
        assertNum(component.height, 4);

        component.axis = 2;     // Z
        assertNum(component.axis, 2);

        // Total shapes created: for chaging axis 3 times + for changing radius + for changing height
        expect(shapesCreated).to.equal(5);
    });

    it('should describe a cylinder shaped trigger when correct options provided', function() {
        // Test case specific override
        let shapesCreated = 0;
        const cb = btVec => {
            shapesCreated++;
            expect(btVec).to.be.an('object');
            return btShape;
        }
        sinon.stub(Ammo, 'btCylinderShapeX').callsFake(cb);
        sinon.stub(Ammo, 'btCylinderShape').callsFake(cb);
        sinon.stub(Ammo, 'btCylinderShapeZ').callsFake(cb);

        entity.addComponent('collision', { type: 'cylinder' });
        const component = entity.collision;

        assertNum(component.axis, 1);       // Y
        assertNum(component.radius, 0.5);
        assertNum(component.height, 2);

        expect(component.type).to.equal('cylinder');
        expect(entity.trigger).to.be.an('object');

        component.axis = 0;     // X
        component.radius = 2;
        component.height = 4;

        assertNum(component.axis, 0);
        assertNum(component.radius, 2);
        assertNum(component.height, 4);

        component.axis = 2;     // Z
        assertNum(component.axis, 2);

        // Total shapes created: for chaging axis 3 times + for changing radius + for changing height
        expect(shapesCreated).to.equal(5);        
    });

    it('should describe a cone shaped trigger when correct options provided', function() {
        // Test case specific override
        const cb = (radius, height) => {
            shapesCreated++;
            assertNum(radius); assertNum(height);
            return btShape;
        }
        let shapesCreated = 0;
        sinon.stub(Ammo, 'btConeShapeX').callsFake(cb);
        sinon.stub(Ammo, 'btConeShape').callsFake(cb);
        sinon.stub(Ammo, 'btConeShapeZ').callsFake(cb);

        entity.addComponent('collision', { type: 'cone' });
        const component = entity.collision;

        assertNum(component.axis, 1);
        assertNum(component.radius, 0.5);
        assertNum(component.height, 2);

        expect(component.type).to.equal('cone');
        expect(entity.trigger).to.be.an('object');

        component.axis = 0;
        component.radius = 2;
        component.height = 4;

        assertNum(component.axis, 0);
        assertNum(component.radius, 2);
        assertNum(component.height, 4);

        component.axis = 2;     // Z
        assertNum(component.axis, 2);

        // Total shapes created: for chaging axis 3 times + for changing radius + for changing height
        expect(shapesCreated).to.equal(5);          
    });

    // TODO

    // it('should describe a mesh trigger when correct options provided', function() {
    //     entity.addComponent('collision', { type: 'mesh' });
    //     const component = entity.collision;

    //     expect(component.type).to.equal('mesh');
    //     expect(entity.trigger).to.be.an('object');
    // }); 
    
    // it('should describe a compound trigger when correct options provided', function() {
    //     entity.addComponent('collision', { type: 'compound' });
    //     const component = entity.collision;

    //     expect(component.type).to.equal('compound');
    //     expect(entity.trigger).to.be.an('object');
    // });     

});
