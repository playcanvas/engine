import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

import { expect } from 'chai';

import { math } from '../../../src/core/math/math.js';
import { Vec3 } from '../../../src/core/math/vec3.js';
import { Entity } from '../../../src/framework/entity.js';
import { NullPhysicsWorld } from '../../../src/framework/physics/null/null-physics-world.js';
import { createScript } from '../../../src/framework/script/script-create.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

const source = readFileSync(new URL('../../../scripts/physics/vehicle.js', import.meta.url), 'utf8');

class VehicleTestWorld extends NullPhysicsWorld {
    actions = [];

    registrations = [];

    retirements = [];

    constructor() {
        super();
        this.nativeWorld = {
            addAction: (action) => {
                this.actions.push(action);
                this.registrations.push(action);
            },
            removeAction: (action) => {
                const index = this.actions.indexOf(action);
                if (index !== -1) this.actions.splice(index, 1);
            }
        };
    }

    createBody(desc) {
        const body = super.createBody(desc);
        body.nativeBody = { setActivationState() {} };
        return body;
    }

    destroyBody(body) {
        this.retirements.push({
            chassis: body.nativeBody,
            actions: this.actions.filter(action => action.chassis === body.nativeBody)
        });
    }
}

class RaycastVehicle {
    wheels = [];

    forces = [];

    constructor(tuning, chassis, rayCaster) {
        Object.assign(this, { chassis, rayCaster, tuning });
    }

    setCoordinateSystem() {}

    addWheel(point) {
        this.wheels.push([...point.values]);
        return {
            set_m_suspensionStiffness() {},
            set_m_wheelsDampingRelaxation() {},
            set_m_wheelsDampingCompression() {},
            set_m_frictionSlip() {},
            set_m_rollInfluence() {}
        };
    }

    getNumWheels() {
        return this.wheels.length;
    }

    getCurrentSpeedKmHour() {
        return 15;
    }

    setSteeringValue() {}

    applyEngineForce(force, index) {
        this.forces[index] = force;
    }

    setBrake() {}

    updateWheelTransform() {}

    getWheelTransformWS() {
        return {
            getOrigin: () => ({ x: () => 0, y: () => 3, z: () => 0 }),
            getRotation: () => ({ x: () => 0, y: () => 0, z: () => 0, w: () => 1 })
        };
    }
}

class VehicleTuning {}

describe('Bundled vehicle script', function () {
    let app;
    let world;
    let destroyed;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        world = new VehicleTestWorld();
        app.systems.rigidbody.setPhysicsWorld(world);
        destroyed = [];
        const ammo = {
            btRaycastVehicle: RaycastVehicle,
            btVehicleTuning: VehicleTuning,
            btDefaultVehicleRaycaster: class {},
            btVector3: class {
                constructor(x, y, z) {
                    this.setValue(x, y, z);
                }

                setValue(x, y, z) {
                    this.values = [x, y, z];
                }
            },
            destroy: (resource) => {
                expect(resource).not.to.be.an.instanceof(VehicleTuning);
                destroyed.push(resource);
            }
        };
        runInNewContext(source, { pc: { createScript, math }, Ammo: ammo });
    });

    afterEach(function () {
        app.destroy();
        jsdomTeardown();
    });

    function createChassis(withShape = true) {
        const chassis = new Entity('chassis', app);
        app.root.addChild(chassis);
        chassis.addComponent('rigidbody', { type: 'dynamic' });
        if (withShape) chassis.addComponent('collision');
        const wheels = [
            [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1]
        ].map((position, index) => {
            const wheel = new Entity(`wheel ${index}`, app);
            wheel.setLocalPosition(...position);
            chassis.addChild(wheel);
            wheel.addComponent('script');
            wheel.script.create('vehicleWheel', { attributes: { isFront: index < 2 } });
            return wheel;
        });
        chassis.addComponent('script');
        chassis.script.create('vehicle', { attributes: { wheels } });
        app.systems.fire('initialize', app.root);
        app.systems.fire('postInitialize', app.root);
        return chassis;
    }

    function update() {
        app.systems.fire('update', 1 / 60);
    }

    it('detaches the previous action before body retirement and rebinds the wheels to the current body', function () {
        const chassis = createChassis();
        const script = chassis.script.vehicle;
        expect(script.speed).to.equal(15);
        expect(world.actions).to.have.length(1);

        script.fire('vehicle:controls', 0.1, 1);
        update();
        const previous = world.actions[0];
        expect(previous.chassis).to.equal(chassis.rigidbody.body);
        expect(script.wheels[0].getLocalPosition().y).to.equal(3);

        chassis.collision.halfExtents = new Vec3(1, 0.5, 1);

        expect(world.retirements).to.deep.equal([{ chassis: previous.chassis, actions: [] }]);
        expect(world.actions).to.be.empty;
        expect(destroyed).to.include(previous);
        expect(destroyed).to.include(previous.rayCaster);

        update();
        expect(world.actions).to.have.length(1);
        const current = world.actions[0];
        expect(current.chassis).to.equal(chassis.rigidbody.body);
        expect(current).not.to.equal(previous);
        expect(current.tuning).to.equal(previous.tuning);
        expect(current.wheels).to.deep.equal([[1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1]]);
        expect(current.forces.slice(2)).to.deep.equal([script.maxEngineForce, script.maxEngineForce]);
    });

    it('waits for a body when the vehicle script initializes first', function () {
        const chassis = createChassis(false);
        const script = chassis.script.vehicle;
        update();
        expect(world.registrations).to.be.empty;
        expect(script.speed).to.equal(0);

        chassis.addComponent('collision');
        update();
        expect(world.actions).to.have.length(1);
        expect(world.actions[0].chassis).to.equal(chassis.rigidbody.body);
        expect(script.speed).to.equal(15);
    });

    it('only reuses the action on enable when its chassis remains the same', function () {
        const chassis = createChassis();
        const script = chassis.script.vehicle;
        update();
        const previous = world.actions[0];

        script.enabled = false;
        expect(world.actions).to.be.empty;
        script.update(1 / 60);
        expect(world.actions).to.be.empty;

        script.enabled = true;
        expect(world.actions).to.deep.equal([previous]);
        update();
        expect(world.registrations).to.deep.equal([previous, previous]);

        script.enabled = false;
        chassis.collision.halfExtents = new Vec3(1, 0.5, 1);
        expect(destroyed).to.include(previous);
        script.enabled = true;
        update();

        expect(world.actions).to.have.length(1);
        expect(world.actions[0]).not.to.equal(previous);
        expect(world.actions[0].chassis).to.equal(chassis.rigidbody.body);
        expect(world.registrations.slice(2)).to.deep.equal(world.actions);
    });

    it('releases the action on component removal and on script destruction', function () {
        const chassis = createChassis();
        update();
        const previous = world.actions[0];
        const previousComponent = chassis.rigidbody;

        chassis.removeComponent('rigidbody');
        expect(world.actions).to.be.empty;
        expect(world.retirements).to.deep.equal([{ chassis: previous.chassis, actions: [] }]);
        expect(destroyed).to.include(previous);
        expect(previousComponent.hasEvent('simulationdisabled')).to.equal(false);
        expect(previousComponent.hasEvent('beforeremove')).to.equal(false);
        update();
        expect(world.actions).to.be.empty;

        chassis.addComponent('rigidbody', { type: 'dynamic' });
        update();
        expect(world.actions).to.have.length(1);
        const current = world.actions[0];
        expect(current.chassis).to.equal(chassis.rigidbody.body);

        chassis.script.destroy('vehicle');
        expect(world.actions).to.be.empty;
        for (const resource of [current, current.rayCaster]) {
            expect(destroyed.filter(value => value === resource)).to.have.length(1);
        }
        expect(chassis.rigidbody.hasEvent('simulationdisabled')).to.equal(false);
        expect(chassis.rigidbody.hasEvent('beforeremove')).to.equal(false);
    });
});
