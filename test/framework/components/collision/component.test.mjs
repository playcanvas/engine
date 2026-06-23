import { expect } from 'chai';

import { Quat } from '../../../../src/core/math/quat.js';
import { Vec3 } from '../../../../src/core/math/vec3.js';
import { Asset } from '../../../../src/framework/asset/asset.js';
import { Entity } from '../../../../src/framework/entity.js';
import { Model } from '../../../../src/scene/model.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('CollisionComponent', function () {
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

    describe('#addComponent', function () {

        it('creates a component with sensible defaults', function () {
            const e = new Entity();
            e.addComponent('collision');

            expect(e.collision).to.exist;
            expect(e.collision.enabled).to.equal(true);
            expect(e.collision.type).to.equal('box');
            expect(e.collision.halfExtents.equals(new Vec3(0.5, 0.5, 0.5))).to.equal(true);
            expect(e.collision.linearOffset.equals(new Vec3())).to.equal(true);
            expect(e.collision.angularOffset.equals(new Quat())).to.equal(true);
            expect(e.collision.radius).to.equal(0.5);
            expect(e.collision.axis).to.equal(1);
            expect(e.collision.height).to.equal(2);
            expect(e.collision.convexHull).to.equal(false);
            expect(e.collision.asset).to.equal(null);
            expect(e.collision.renderAsset).to.equal(null);
            expect(e.collision.checkVertexDuplicates).to.equal(true);
            expect(e.collision.shape).to.equal(null);
            expect(e.collision.render).to.equal(null);
            // non-mesh initialization creates a placeholder model
            expect(e.collision.model).to.be.an.instanceof(Model);
        });

        it('round-trips every property passed via the data argument', function () {
            const e = new Entity();
            e.addComponent('collision', {
                enabled: false,
                type: 'capsule',
                halfExtents: new Vec3(1, 2, 3),
                linearOffset: new Vec3(4, 5, 6),
                angularOffset: new Quat().setFromEulerAngles(0, 90, 0),
                radius: 2,
                axis: 0,
                height: 5,
                convexHull: true,
                asset: 42,
                renderAsset: 43,
                checkVertexDuplicates: false
            });

            const c = e.collision;
            expect(c.enabled).to.equal(false);
            expect(c.type).to.equal('capsule');
            expect(c.halfExtents.equals(new Vec3(1, 2, 3))).to.equal(true);
            expect(c.linearOffset.equals(new Vec3(4, 5, 6))).to.equal(true);
            expect(c.angularOffset.equals(new Quat().setFromEulerAngles(0, 90, 0))).to.equal(true);
            expect(c.radius).to.equal(2);
            expect(c.axis).to.equal(0);
            expect(c.height).to.equal(5);
            expect(c.convexHull).to.equal(true);
            expect(c.asset).to.equal(42);
            expect(c.renderAsset).to.equal(43);
            expect(c.checkVertexDuplicates).to.equal(false);
        });

        it('converts arrays to Vec3 for halfExtents and linearOffset', function () {
            const e = new Entity();
            e.addComponent('collision', {
                halfExtents: [1, 2, 3],
                linearOffset: [4, 5, 6]
            });

            expect(e.collision.halfExtents).to.be.an.instanceof(Vec3);
            expect(e.collision.halfExtents.equals(new Vec3(1, 2, 3))).to.equal(true);
            expect(e.collision.linearOffset).to.be.an.instanceof(Vec3);
            expect(e.collision.linearOffset.equals(new Vec3(4, 5, 6))).to.equal(true);
        });

        it('converts a 4 element array to Quat for angularOffset', function () {
            const source = new Quat().setFromEulerAngles(10, 20, 30);

            const e = new Entity();
            e.addComponent('collision', {
                angularOffset: [source.x, source.y, source.z, source.w]
            });

            expect(e.collision.angularOffset).to.be.an.instanceof(Quat);
            expect(e.collision.angularOffset.equals(source)).to.equal(true);
        });

        it('treats a 3 element array as euler angles for angularOffset', function () {
            const e = new Entity();
            e.addComponent('collision', {
                angularOffset: [0, 90, 0]
            });

            expect(e.collision.angularOffset.equals(new Quat().setFromEulerAngles(0, 90, 0))).to.equal(true);
        });

        it('preserves class-field defaults when properties are passed as explicit undefined', function () {
            const e = new Entity();
            e.addComponent('collision', {
                halfExtents: undefined,
                radius: undefined,
                type: undefined
            });

            expect(e.collision.type).to.equal('box');
            expect(e.collision.halfExtents.equals(new Vec3(0.5, 0.5, 0.5))).to.equal(true);
            expect(e.collision.radius).to.equal(0.5);
        });

        it('falls back to the default type for falsy type values', function () {
            const e = new Entity();
            e.addComponent('collision', { type: null });

            expect(e.collision.type).to.equal('box');
            expect(app.systems.collision.implementations.box).to.exist;
        });

        it('copies Vec3 inputs so caller mutations do not leak into component state', function () {
            const source = new Vec3(1, 2, 3);

            const e = new Entity();
            e.addComponent('collision', { halfExtents: source });

            expect(e.collision.halfExtents).to.not.equal(source);

            source.x = 9;
            expect(e.collision.halfExtents.x).to.equal(1);
        });

        it('ignores shape passed via the data argument', function () {
            const e = new Entity();
            e.addComponent('collision', { shape: {} });

            expect(e.collision.shape).to.equal(null);
        });

        it('ignores shape on a mesh component without throwing', function () {
            const e = new Entity();

            expect(() => e.addComponent('collision', { type: 'mesh', shape: {} })).to.not.throw();
            expect(e.collision.shape).to.equal(null);
        });

        it('ignores model and render when an asset is also supplied', function () {
            const model = new Model();

            const e = new Entity();
            e.addComponent('collision', { type: 'mesh', asset: 99, model: model });

            expect(e.collision.asset).to.equal(99);
            expect(e.collision.model).to.equal(null);
        });

        it('accepts a model when no asset is supplied', function () {
            const model = new Model();

            const e = new Entity();
            e.addComponent('collision', { type: 'mesh', model: model });

            expect(e.collision.model).to.equal(model);
        });

    });

    describe('#asset', function () {

        it('normalizes an Asset instance to its id', function () {
            const asset = new Asset('model', 'model');
            app.assets.add(asset);

            const e = new Entity();
            e.addComponent('collision');

            e.collision.asset = asset;
            expect(e.collision.asset).to.equal(asset.id);
        });

        it('normalizes an Asset instance to its id for renderAsset', function () {
            const asset = new Asset('render', 'render');
            app.assets.add(asset);

            const e = new Entity();
            e.addComponent('collision');

            e.collision.renderAsset = asset;
            expect(e.collision.renderAsset).to.equal(asset.id);
        });

        it('clears the asset property when the asset is removed from the registry', function () {
            const asset = new Asset('model', 'model');
            app.assets.add(asset);

            const e = new Entity();
            e.addComponent('collision', { asset: asset.id });

            app.assets.remove(asset);
            expect(e.collision.asset).to.equal(null);
        });

        it('unsubscribes from the previous asset when reassigned', function () {
            const asset1 = new Asset('model1', 'model');
            const asset2 = new Asset('model2', 'model');
            app.assets.add(asset1);
            app.assets.add(asset2);

            const e = new Entity();
            e.addComponent('collision');

            e.collision.asset = asset1;
            expect(asset1.hasEvent('remove')).to.equal(true);

            e.collision.asset = asset2;
            expect(asset1.hasEvent('remove')).to.equal(false);
            expect(asset2.hasEvent('remove')).to.equal(true);
        });

    });

    describe('#type', function () {

        it('changes type and creates the new implementation', function () {
            const e = new Entity();
            e.addComponent('collision');

            e.collision.type = 'sphere';

            expect(e.collision.type).to.equal('sphere');
            expect(app.systems.collision.implementations.sphere).to.exist;
        });

        it('is a no-op when the type is unchanged', function () {
            const e = new Entity();
            e.addComponent('collision');

            const system = app.systems.collision;
            let calls = 0;
            const original = system.changeType;
            system.changeType = function (...args) {
                calls++;
                return original.apply(this, args);
            };

            e.collision.type = 'box';
            expect(calls).to.equal(0);

            system.changeType = original;
        });

    });

    describe('shape recreation', function () {

        /**
         * Patch the system-level recreatePhysicalShapes dispatcher and count calls.
         *
         * @returns {{ count: () => number }} The call counter.
         */
        function patchRecreate() {
            const system = app.systems.collision;
            let calls = 0;
            system.recreatePhysicalShapes = function () {
                calls++;
            };
            return { count: () => calls };
        }

        it('recreates the shape when halfExtents is set on a box', function () {
            const e = new Entity();
            e.addComponent('collision');

            const counter = patchRecreate();
            e.collision.halfExtents = new Vec3(1, 2, 3);

            expect(counter.count()).to.equal(1);
        });

        it('recreates the shape when the returned halfExtents is mutated and reassigned', function () {
            const e = new Entity();
            e.addComponent('collision');

            const counter = patchRecreate();
            const he = e.collision.halfExtents;
            he.x = 2;
            e.collision.halfExtents = he;

            expect(counter.count()).to.equal(1);
            expect(e.collision.halfExtents.x).to.equal(2);
        });

        it('converts arrays assigned after initialization', function () {
            const e = new Entity();
            e.addComponent('collision');

            patchRecreate();
            e.collision.halfExtents = [1, 2, 3];
            e.collision.linearOffset = [4, 5, 6];

            expect(e.collision.halfExtents.equals(new Vec3(1, 2, 3))).to.equal(true);
            expect(e.collision.linearOffset.equals(new Vec3(4, 5, 6))).to.equal(true);
        });

        it('recreates the shape for radius, height and axis on a capsule but not a box', function () {
            const box = new Entity();
            box.addComponent('collision');

            const capsule = new Entity();
            capsule.addComponent('collision', { type: 'capsule' });

            const counter = patchRecreate();

            box.collision.radius = 1;
            box.collision.height = 3;
            box.collision.axis = 0;
            expect(counter.count()).to.equal(0);

            capsule.collision.radius = 1;
            capsule.collision.height = 3;
            capsule.collision.axis = 0;
            expect(counter.count()).to.equal(3);
        });

        it('routes model, render and convexHull changes to the mesh implementation', function () {
            const box = new Entity();
            box.addComponent('collision');

            const mesh = new Entity();
            mesh.addComponent('collision', { type: 'mesh' });

            const impl = app.systems.collision.implementations.mesh;
            let calls = 0;
            impl.doRecreatePhysicalShape = function () {
                calls++;
            };

            box.collision.convexHull = true;
            box.collision.model = null;
            expect(calls).to.equal(0);

            mesh.collision.convexHull = true;
            mesh.collision.model = new Model();
            mesh.collision.render = null;
            expect(calls).to.equal(3);
        });

    });

    describe('offsets', function () {

        it('applies linear and angular offsets to the shape transform', function () {
            const e = new Entity();
            e.addComponent('collision');

            e.collision.linearOffset = new Vec3(1, 2, 3);
            expect(e.collision.getShapePosition().equals(new Vec3(1, 2, 3))).to.equal(true);

            const offset = new Quat().setFromEulerAngles(0, 90, 0);
            e.collision.angularOffset = offset;
            expect(e.collision.getShapeRotation().equals(offset)).to.equal(true);
        });

        it('returns the entity transform when the offsets are cleared', function () {
            const e = new Entity();
            e.addComponent('collision', { linearOffset: [1, 2, 3], angularOffset: [0, 90, 0] });

            e.collision.linearOffset = Vec3.ZERO;
            e.collision.angularOffset = Quat.IDENTITY;

            expect(e.collision.getShapePosition().equals(e.getPosition())).to.equal(true);
            expect(e.collision.getShapeRotation().equals(e.getRotation())).to.equal(true);
        });

    });

    describe('#cloneComponent', function () {

        it('clones every property', function () {
            const e = new Entity();
            e.addComponent('collision', {
                enabled: false,
                type: 'capsule',
                halfExtents: new Vec3(1, 2, 3),
                linearOffset: new Vec3(4, 5, 6),
                angularOffset: new Quat().setFromEulerAngles(0, 90, 0),
                radius: 2,
                axis: 0,
                height: 5,
                convexHull: true,
                asset: 42,
                renderAsset: 43,
                checkVertexDuplicates: false
            });

            const clone = e.clone();
            const c = clone.collision;

            expect(c).to.exist;
            expect(c.enabled).to.equal(false);
            expect(c.type).to.equal('capsule');
            expect(c.halfExtents.equals(new Vec3(1, 2, 3))).to.equal(true);
            expect(c.halfExtents).to.not.equal(e.collision.halfExtents);
            expect(c.linearOffset.equals(new Vec3(4, 5, 6))).to.equal(true);
            expect(c.linearOffset).to.not.equal(e.collision.linearOffset);
            expect(c.angularOffset.equals(new Quat().setFromEulerAngles(0, 90, 0))).to.equal(true);
            expect(c.angularOffset).to.not.equal(e.collision.angularOffset);
            expect(c.radius).to.equal(2);
            expect(c.axis).to.equal(0);
            expect(c.height).to.equal(5);
            expect(c.convexHull).to.equal(true);
            expect(c.asset).to.equal(42);
            expect(c.renderAsset).to.equal(43);
            expect(c.checkVertexDuplicates).to.equal(false);
            expect(c.shape).to.equal(null);
        });

    });

    describe('lifecycle', function () {

        it('detaches listeners when the component is removed', function () {
            const asset = new Asset('model', 'model');
            app.assets.add(asset);

            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('collision', { asset: asset.id });

            expect(asset.hasEvent('remove')).to.equal(true);
            expect(e.hasEvent('insert')).to.equal(true);

            e.removeComponent('collision');

            expect(asset.hasEvent('remove')).to.equal(false);
            expect(e.hasEvent('insert')).to.equal(false);
        });

        it('survives a disable and enable round trip', function () {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('collision');

            e.collision.enabled = false;
            expect(e.collision.enabled).to.equal(false);

            e.collision.enabled = true;
            expect(e.collision.enabled).to.equal(true);
        });

        it('destroys the entity without throwing', function () {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('collision');

            expect(() => e.destroy()).to.not.throw();
            expect(e.collision).to.not.exist;
        });

    });

});
