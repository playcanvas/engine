import { expect } from 'chai';

import { Vec2 } from '../../../../src/core/math/vec2.js';
import { Vec3 } from '../../../../src/core/math/vec3.js';
import {
    JOINTTYPE_6DOF, JOINTTYPE_BALL, JOINTTYPE_FIXED, JOINTTYPE_HINGE, JOINTTYPE_SLIDER,
    MOTION_FREE, MOTION_LIMITED, MOTION_LOCKED
} from '../../../../src/framework/components/joint/constants.js';
import { Entity } from '../../../../src/framework/entity.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('JointComponent', function () {
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    /**
     * @param {Entity|null} entityA - The first constrained entity.
     * @param {Entity|null} entityB - The second constrained entity.
     * @returns {object} A data object assigning a distinct value to every joint property.
     */
    function fullData(entityA, entityB) {
        return {
            enabled: false,
            type: JOINTTYPE_HINGE,
            entityA: entityA,
            entityB: entityB,
            enableCollision: true,
            breakImpulse: 500,
            enableLimits: true,
            limits: new Vec2(-10, 80),
            motorSpeed: 90,
            maxMotorForce: 12,
            swingLimitY: 30,
            swingLimitZ: 25,
            twistLimit: 10,
            linearMotionX: MOTION_LIMITED,
            linearMotionY: MOTION_FREE,
            linearMotionZ: MOTION_LOCKED,
            linearLimitsX: new Vec2(-1, 1),
            linearLimitsY: new Vec2(-2, 2),
            linearLimitsZ: new Vec2(-3, 3),
            linearStiffness: new Vec3(100, 200, 300),
            linearDamping: new Vec3(0.5, 0.6, 0.7),
            linearEquilibrium: new Vec3(1, 2, 3),
            angularMotionX: MOTION_FREE,
            angularMotionY: MOTION_LIMITED,
            angularMotionZ: MOTION_LOCKED,
            angularLimitsX: new Vec2(-10, 10),
            angularLimitsY: new Vec2(-20, 20),
            angularLimitsZ: new Vec2(-30, 30),
            angularStiffness: new Vec3(10, 20, 30),
            angularDamping: new Vec3(0.1, 0.2, 0.3),
            angularEquilibrium: new Vec3(5, 10, 15)
        };
    }

    function expectFullData(c, entityA, entityB) {
        expect(c.enabled).to.equal(false);
        expect(c.type).to.equal(JOINTTYPE_HINGE);
        expect(c.entityA).to.equal(entityA);
        expect(c.entityB).to.equal(entityB);
        expect(c.enableCollision).to.equal(true);
        expect(c.breakImpulse).to.equal(500);
        expect(c.enableLimits).to.equal(true);
        expect(c.limits.equals(new Vec2(-10, 80))).to.equal(true);
        expect(c.motorSpeed).to.equal(90);
        expect(c.maxMotorForce).to.equal(12);
        expect(c.swingLimitY).to.equal(30);
        expect(c.swingLimitZ).to.equal(25);
        expect(c.twistLimit).to.equal(10);
        expect(c.linearMotionX).to.equal(MOTION_LIMITED);
        expect(c.linearMotionY).to.equal(MOTION_FREE);
        expect(c.linearMotionZ).to.equal(MOTION_LOCKED);
        expect(c.linearLimitsX.equals(new Vec2(-1, 1))).to.equal(true);
        expect(c.linearLimitsY.equals(new Vec2(-2, 2))).to.equal(true);
        expect(c.linearLimitsZ.equals(new Vec2(-3, 3))).to.equal(true);
        expect(c.linearStiffness.equals(new Vec3(100, 200, 300))).to.equal(true);
        expect(c.linearDamping.equals(new Vec3(0.5, 0.6, 0.7))).to.equal(true);
        expect(c.linearEquilibrium.equals(new Vec3(1, 2, 3))).to.equal(true);
        expect(c.angularMotionX).to.equal(MOTION_FREE);
        expect(c.angularMotionY).to.equal(MOTION_LIMITED);
        expect(c.angularMotionZ).to.equal(MOTION_LOCKED);
        expect(c.angularLimitsX.equals(new Vec2(-10, 10))).to.equal(true);
        expect(c.angularLimitsY.equals(new Vec2(-20, 20))).to.equal(true);
        expect(c.angularLimitsZ.equals(new Vec2(-30, 30))).to.equal(true);
        expect(c.angularStiffness.equals(new Vec3(10, 20, 30))).to.equal(true);
        expect(c.angularDamping.equals(new Vec3(0.1, 0.2, 0.3))).to.equal(true);
        expect(c.angularEquilibrium.equals(new Vec3(5, 10, 15))).to.equal(true);
    }

    describe('#addComponent', function () {

        it('creates a component with sensible defaults', function () {
            const e = new Entity();
            e.addComponent('joint');

            const c = e.joint;
            expect(c).to.exist;
            expect(c.enabled).to.equal(true);
            expect(c.type).to.equal(JOINTTYPE_FIXED);
            expect(c.entityA).to.equal(null);
            expect(c.entityB).to.equal(null);
            expect(c.enableCollision).to.equal(false);
            expect(c.breakImpulse).to.equal(Infinity);
            expect(c.constraint).to.equal(null);
            expect(c.isBroken).to.equal(false);
            expect(c.enableLimits).to.equal(false);
            expect(c.limits.equals(new Vec2(-45, 45))).to.equal(true);
            expect(c.motorSpeed).to.equal(0);
            expect(c.maxMotorForce).to.equal(0);
            expect(c.swingLimitY).to.equal(45);
            expect(c.swingLimitZ).to.equal(45);
            expect(c.twistLimit).to.equal(20);
            for (const axis of ['X', 'Y', 'Z']) {
                expect(c[`linearMotion${axis}`]).to.equal(MOTION_LOCKED);
                expect(c[`linearLimits${axis}`].equals(new Vec2())).to.equal(true);
                expect(c[`angularMotion${axis}`]).to.equal(MOTION_LOCKED);
                expect(c[`angularLimits${axis}`].equals(new Vec2())).to.equal(true);
            }
            expect(c.linearStiffness.equals(new Vec3())).to.equal(true);
            expect(c.linearDamping.equals(new Vec3(1, 1, 1))).to.equal(true);
            expect(c.linearEquilibrium.equals(new Vec3())).to.equal(true);
            expect(c.angularStiffness.equals(new Vec3())).to.equal(true);
            expect(c.angularDamping.equals(new Vec3(1, 1, 1))).to.equal(true);
            expect(c.angularEquilibrium.equals(new Vec3())).to.equal(true);
        });

        it('round-trips every property passed via the data argument', function () {
            const entityA = new Entity('a');
            const entityB = new Entity('b');
            app.root.addChild(entityA);
            app.root.addChild(entityB);

            const e = new Entity();
            e.addComponent('joint', fullData(entityA, entityB));

            expectFullData(e.joint, entityA, entityB);
        });

        it('converts arrays to Vec2 and Vec3', function () {
            const e = new Entity();
            e.addComponent('joint', {
                limits: [-10, 80],
                linearLimitsX: [-1, 1],
                angularLimitsZ: [-30, 30],
                linearStiffness: [100, 200, 300],
                angularEquilibrium: [5, 10, 15]
            });

            expect(e.joint.limits).to.be.an.instanceof(Vec2);
            expect(e.joint.limits.equals(new Vec2(-10, 80))).to.equal(true);
            expect(e.joint.linearLimitsX.equals(new Vec2(-1, 1))).to.equal(true);
            expect(e.joint.angularLimitsZ.equals(new Vec2(-30, 30))).to.equal(true);
            expect(e.joint.linearStiffness).to.be.an.instanceof(Vec3);
            expect(e.joint.linearStiffness.equals(new Vec3(100, 200, 300))).to.equal(true);
            expect(e.joint.angularEquilibrium.equals(new Vec3(5, 10, 15))).to.equal(true);
        });

        it('preserves class-field defaults when properties are passed as explicit undefined', function () {
            const e = new Entity();
            e.addComponent('joint', {
                type: undefined,
                limits: undefined,
                entityA: undefined,
                breakImpulse: undefined
            });

            expect(e.joint.type).to.equal(JOINTTYPE_FIXED);
            expect(e.joint.limits.equals(new Vec2(-45, 45))).to.equal(true);
            expect(e.joint.entityA).to.equal(null);
            expect(e.joint.breakImpulse).to.equal(Infinity);
        });

        it('copies Vec2 inputs so caller mutations do not leak into component state', function () {
            const source = new Vec2(-10, 80);

            const e = new Entity();
            e.addComponent('joint', { limits: source });

            expect(e.joint.limits).to.not.equal(source);

            source.x = 9;
            expect(e.joint.limits.x).to.equal(-10);
        });

        it('keeps the previous type for invalid type values', function () {
            const e = new Entity();
            e.addComponent('joint', { type: 'bogus' });

            expect(e.joint.type).to.equal(JOINTTYPE_FIXED);
        });

    });

    describe('#type', function () {

        it('accepts every valid joint type', function () {
            const e = new Entity();
            e.addComponent('joint');

            for (const type of [JOINTTYPE_BALL, JOINTTYPE_HINGE, JOINTTYPE_SLIDER, JOINTTYPE_6DOF, JOINTTYPE_FIXED]) {
                e.joint.type = type;
                expect(e.joint.type).to.equal(type);
            }
        });

    });

    describe('#entityA/#entityB', function () {

        it('accepts an entity GUID and resolves it to the entity', function () {
            const target = new Entity('target');
            app.root.addChild(target);

            const e = new Entity();
            e.addComponent('joint');
            e.joint.entityA = target.guid;

            expect(e.joint.entityA).to.equal(target);
        });

        it('resolves an unknown GUID to null', function () {
            const e = new Entity();
            e.addComponent('joint');
            e.joint.entityA = 'not-a-real-guid';

            expect(e.joint.entityA).to.equal(null);
        });

        it('unsubscribes from the previous entity when reassigned', function () {
            const first = new Entity('first');
            const second = new Entity('second');
            app.root.addChild(first);
            app.root.addChild(second);

            const e = new Entity();
            e.addComponent('joint');

            e.joint.entityA = first;
            expect(first.hasEvent('destroy')).to.equal(true);

            e.joint.entityA = second;
            expect(first.hasEvent('destroy')).to.equal(false);
            expect(second.hasEvent('destroy')).to.equal(true);

            e.joint.entityA = null;
            expect(second.hasEvent('destroy')).to.equal(false);
        });

        it('clears the reference when the referenced entity is destroyed', function () {
            const target = new Entity('target');
            app.root.addChild(target);

            const e = new Entity();
            e.addComponent('joint', { entityA: target });

            target.destroy();
            expect(e.joint.entityA).to.equal(null);
        });

    });

    describe('#breakImpulse', function () {

        it('stores the value before any constraint exists', function () {
            const e = new Entity();
            e.addComponent('joint');

            e.joint.breakImpulse = 250;
            expect(e.joint.breakImpulse).to.equal(250);
        });

    });

    describe('property assignment without physics', function () {

        it('accepts every property after creation without throwing', function () {
            const entityA = new Entity('a');
            const entityB = new Entity('b');
            app.root.addChild(entityA);
            app.root.addChild(entityB);

            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('joint');

            const data = fullData(entityA, entityB);
            expect(() => {
                for (const key in data) {
                    e.joint[key] = data[key];
                }
            }).to.not.throw();

            expectFullData(e.joint, entityA, entityB);
        });

    });

    describe('#cloneComponent', function () {

        it('clones every property', function () {
            const entityA = new Entity('a');
            const entityB = new Entity('b');
            app.root.addChild(entityA);
            app.root.addChild(entityB);

            const e = new Entity();
            e.addComponent('joint', fullData(entityA, entityB));

            const clone = e.clone();

            // references to entities outside the cloned subtree are preserved
            expectFullData(clone.joint, entityA, entityB);
            expect(clone.joint.limits).to.not.equal(e.joint.limits);
            expect(clone.joint.linearLimitsX).to.not.equal(e.joint.linearLimitsX);
            expect(clone.joint.linearStiffness).to.not.equal(e.joint.linearStiffness);
        });

        it('remaps entity references within the cloned subtree', function () {
            const root = new Entity('root');
            const bodyA = new Entity('bodyA');
            const bodyB = new Entity('bodyB');
            const jointEntity = new Entity('joint');
            root.addChild(bodyA);
            root.addChild(bodyB);
            root.addChild(jointEntity);
            app.root.addChild(root);

            jointEntity.addComponent('joint', { entityA: bodyA, entityB: bodyB });

            const cloneRoot = root.clone();
            app.root.addChild(cloneRoot);

            const cloneJoint = cloneRoot.findByName('joint').joint;
            expect(cloneJoint.entityA).to.equal(cloneRoot.findByName('bodyA'));
            expect(cloneJoint.entityB).to.equal(cloneRoot.findByName('bodyB'));
            expect(cloneJoint.entityA).to.not.equal(bodyA);
            expect(cloneJoint.entityB).to.not.equal(bodyB);
        });

    });

    describe('lifecycle', function () {

        it('leaves and rejoins the pending set across a disable and enable round trip', function () {
            const target = new Entity('target');
            app.root.addChild(target);

            const e = new Entity();
            app.root.addChild(e);
            // entityA has no rigidbody, so the joint cannot create its constraint yet and parks
            // itself in the system's pending set to await a body. (Constraint creation and
            // teardown themselves require Ammo and are exercised by the joints example.)
            e.addComponent('joint', { entityA: target });

            const system = app.systems.joint;
            expect(system._pending.has(e.joint)).to.equal(true);

            e.joint.enabled = false;
            expect(e.joint.enabled).to.equal(false);
            expect(system._pending.has(e.joint)).to.equal(false);

            e.joint.enabled = true;
            expect(e.joint.enabled).to.equal(true);
            expect(system._pending.has(e.joint)).to.equal(true);
        });

        it('detaches entity listeners when the component is removed', function () {
            const target = new Entity('target');
            app.root.addChild(target);

            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('joint', { entityA: target });

            expect(target.hasEvent('destroy')).to.equal(true);

            e.removeComponent('joint');

            expect(target.hasEvent('destroy')).to.equal(false);
        });

        it('destroys the entity without throwing', function () {
            const target = new Entity('target');
            app.root.addChild(target);

            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('joint', { entityA: target });

            expect(() => e.destroy()).to.not.throw();
            expect(e.joint).to.not.exist;
            expect(target.hasEvent('destroy')).to.equal(false);
        });

        it('survives destroying the referenced entities and then the joint entity', function () {
            const targetA = new Entity('targetA');
            const targetB = new Entity('targetB');
            app.root.addChild(targetA);
            app.root.addChild(targetB);

            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('joint', { entityA: targetA, entityB: targetB.guid });

            expect(e.joint.entityB).to.equal(targetB);

            expect(() => {
                targetA.destroy();
                targetB.destroy();
                e.destroy();
            }).to.not.throw();
        });

    });

});
