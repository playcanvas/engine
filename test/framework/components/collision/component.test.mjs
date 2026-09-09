import { expect } from 'chai';
import { restore, spy, stub } from 'sinon';

import { Quat } from '../../../../src/core/math/quat.js';
import { Vec3 } from '../../../../src/core/math/vec3.js';
import { Asset } from '../../../../src/framework/asset/asset.js';
import { Entity } from '../../../../src/framework/entity.js';
import { NullPhysicsWorld } from '../../../../src/framework/physics/null/null-physics-world.js';
import { PhysicsBody } from '../../../../src/framework/physics/physics-body.js';
import { GraphNode } from '../../../../src/scene/graph-node.js';
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
        restore();
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
            expect(e.collision.model).to.equal(null);
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

        it('changes type', function () {
            const e = new Entity();
            e.addComponent('collision');

            e.collision.type = 'sphere';

            expect(e.collision.type).to.equal('sphere');
        });

        it('does not build a mesh shape when a non-mesh type is switched to mesh', function () {
            app.systems.rigidbody.setPhysicsWorld(new NullPhysicsWorld());

            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('collision');

            // no asset, render asset or model was supplied, so there is nothing to build from
            e.collision.type = 'mesh';

            expect(e.collision.model).to.equal(null);
            expect(e.collision.shape).to.equal(null);
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

        it('routes model, render and convexHull changes to the mesh rebuild', function () {
            const box = new Entity();
            box.addComponent('collision');

            const mesh = new Entity();
            mesh.addComponent('collision', { type: 'mesh' });

            const system = app.systems.collision;
            let calls = 0;
            system.doRecreatePhysicalShape = function () {
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

    describe('compound children', function () {

        beforeEach(function () {
            // install the no-op physics backend so the shape lifecycle runs
            app.systems.rigidbody.setPhysicsWorld(new NullPhysicsWorld());
        });

        it('wires a plain collision child to an ancestor compound', function () {
            const parent = new Entity();
            app.root.addChild(parent);
            parent.addComponent('rigidbody');
            parent.addComponent('collision', { type: 'compound' });

            const child = new Entity();
            parent.addChild(child);
            child.addComponent('collision', { type: 'box' });

            expect(child.collision._compoundParent).to.equal(parent.collision);
        });

        it('keeps a child with its own rigidbody independent of an ancestor compound', function () {
            const parent = new Entity();
            app.root.addChild(parent);
            parent.addComponent('rigidbody');
            parent.addComponent('collision', { type: 'compound' });

            const child = new Entity();
            parent.addChild(child);
            child.addComponent('rigidbody');
            child.addComponent('collision', { type: 'box' });

            expect(child.collision._compoundParent).to.equal(null);
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

    describe('mesh scale', function () {
        let world;

        beforeEach(function () {
            world = new NullPhysicsWorld();
            app.systems.rigidbody.setPhysicsWorld(world);
        });

        /**
         * A duck-typed render source - the null backend never reads the geometry.
         *
         * @param {number} [id] - The mesh id.
         * @returns {object} The render source.
         */
        function createRender(id = 1) {
            return { meshes: [{ id: id, primitive: [{ base: 0, count: 3 }] }] };
        }

        /**
         * Creates an initialized mesh collision entity.
         *
         * @param {Entity} [parent] - The parent entity.
         * @param {object} [data] - Extra collision component data.
         * @returns {Entity} The entity.
         */
        function createMeshEntity(parent = app.root, data = {}) {
            const e = new Entity();
            parent.addChild(e);
            e.addComponent('collision', { type: 'mesh', render: createRender(), ...data });
            return e;
        }

        /**
         * Creates a static compound root with a rigid body.
         *
         * @returns {Entity} The root entity.
         */
        function createCompoundRoot() {
            const root = new Entity();
            app.root.addChild(root);
            root.addComponent('rigidbody');
            root.addComponent('collision', { type: 'compound' });
            return root;
        }

        function step() {
            app.systems.rigidbody.step(1 / 60);
        }

        it('rebuilds the shape when the entity world scale changes', function () {
            const e = createMeshEntity();
            const shape = e.collision.shape;
            expect(shape).to.exist;

            e.setLocalScale(2, 2, 2);
            step();

            expect(e.collision.shape).to.exist;
            expect(e.collision.shape).to.not.equal(shape);
            expect(e.collision._builtWorldScale.equals(new Vec3(2, 2, 2))).to.equal(true);
        });

        it('rebuilds the shape when an ancestor scale changes', function () {
            const parent = new Entity();
            app.root.addChild(parent);
            const e = createMeshEntity(parent);
            const shape = e.collision.shape;

            parent.setLocalScale(3, 3, 3);
            step();

            expect(e.collision.shape).to.not.equal(shape);
        });

        it('does not rebuild without a scale change', function () {
            const e = createMeshEntity();
            const shape = e.collision.shape;

            step();
            step();

            expect(e.collision.shape).to.equal(shape);
        });

        it('does not rebuild when the entity merely moves or rotates', function () {
            const e = createMeshEntity();
            const shape = e.collision.shape;

            e.setLocalPosition(1, 2, 3);
            e.setLocalEulerAngles(10, 20, 30);
            step();

            expect(e.collision.shape).to.equal(shape);
        });

        it('defers the rebuild while the component is disabled', function () {
            const e = createMeshEntity();
            const shape = e.collision.shape;

            e.collision.enabled = false;
            e.setLocalScale(2, 2, 2);
            step();
            expect(e.collision.shape).to.equal(shape);

            e.collision.enabled = true;
            step();
            expect(e.collision.shape).to.not.equal(shape);
        });

        it('rebuilds a scaled compound child inside its compound', function () {
            const root = createCompoundRoot();
            const child = createMeshEntity(root);
            expect(child.collision._compoundParent).to.equal(root.collision);
            expect(child.trigger).to.equal(undefined);
            const shape = child.collision.shape;

            const removeChild = spy(world, 'removeCompoundChild');
            const updateChild = spy(world, 'updateCompoundChild');

            root.setLocalScale(2, 2, 2);
            step();

            expect(child.collision.shape).to.not.equal(shape);
            expect(removeChild.calledOnceWith(root.collision.shape, shape)).to.equal(true);
            expect(updateChild.calledOnceWith(root.collision.shape, child.collision.shape)).to.equal(true);
            expect(child.collision._compoundParent).to.equal(root.collision);
            expect(child.trigger).to.equal(undefined);
        });

        it('rebuilds a compound child from a new render source without creating a trigger', function () {
            const root = createCompoundRoot();
            const child = createMeshEntity(root);
            const shape = child.collision.shape;

            const removeChild = spy(world, 'removeCompoundChild');
            const updateChild = spy(world, 'updateCompoundChild');

            child.collision.render = createRender(2);

            expect(child.collision.shape).to.not.equal(shape);
            expect(removeChild.calledOnceWith(root.collision.shape, shape)).to.equal(true);
            expect(updateChild.calledOnceWith(root.collision.shape, child.collision.shape)).to.equal(true);
            expect(child.trigger).to.equal(undefined);
        });

        it('wires an asynchronously loaded mesh child into its compound', function () {
            const root = createCompoundRoot();

            const asset = new Asset('render', 'render');
            app.assets.add(asset);
            // keep the asset pending - the registry would otherwise try to fetch it
            const load = stub(app.assets, 'load');

            const child = new Entity();
            root.addChild(child);
            child.addComponent('collision', { type: 'mesh', renderAsset: asset.id });
            expect(load.called).to.equal(true);
            expect(child.collision.shape).to.equal(null);

            // the asset arrives
            asset.resource = createRender();
            asset.loaded = true;
            asset.fire('load', asset);

            expect(child.collision.shape).to.exist;
            expect(child.collision._compoundParent).to.equal(root.collision);
            expect(child.trigger).to.equal(undefined);
            expect(app.systems.collision._meshComponents).to.include(child.collision);
        });

        it('ignores an asset that finishes loading after the component was removed', function () {
            const asset = new Asset('render', 'render');
            app.assets.add(asset);
            stub(app.assets, 'load');

            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('collision', { type: 'mesh', renderAsset: asset.id });
            const component = e.collision;
            e.removeComponent('collision');

            asset.resource = createRender();
            asset.loaded = true;
            expect(() => asset.fire('load', asset)).to.not.throw();

            expect(component._shape).to.equal(null);
            expect(e.trigger).to.equal(undefined);
            expect(app.systems.collision._meshComponents).to.have.lengthOf(0);
        });

        it('stops watching a component that changes type or is removed', function () {
            const system = app.systems.collision;

            const e = createMeshEntity();
            expect(system._meshComponents).to.include(e.collision);

            e.collision.type = 'box';
            expect(system._meshComponents).to.have.lengthOf(0);

            const e2 = createMeshEntity();
            const component = e2.collision;
            expect(system._meshComponents).to.include(component);

            e2.destroy();
            expect(system._meshComponents).to.have.lengthOf(0);
        });

        it('passes the entity world scale to the backend for render sources', function () {
            const createShape = spy(world, 'createShape');

            const e = new Entity();
            e.setLocalScale(2, 3, 4);
            app.root.addChild(e);
            e.addComponent('collision', { type: 'mesh', render: createRender() });

            const desc = createShape.lastCall.args[0];
            expect(desc.type).to.equal('mesh');
            expect(desc.scale).to.equal(undefined);
            expect(desc.sources).to.have.lengthOf(1);
            expect(desc.sources[0].scale.equals(new Vec3(2, 3, 4))).to.equal(true);
            expect(desc.sources[0].position.equals(Vec3.ZERO)).to.equal(true);
            expect(desc.sources[0].shapeScale).to.equal(undefined);
        });

        it('combines the node and entity scale of model sources', function () {
            const createShape = spy(world, 'createShape');

            // a model whose single node sits 1 unit up, scaled by 2 along X - the collision
            // system only reads the mesh and node of a mesh instance
            const model = new Model();
            model.graph = new GraphNode();
            const node = new GraphNode();
            node.setLocalPosition(0, 1, 0);
            node.setLocalScale(2, 1, 1);
            model.graph.addChild(node);
            model.meshInstances = [{ mesh: createRender().meshes[0], node: node }];

            const e = new Entity();
            e.setLocalScale(3, 3, 3);
            app.root.addChild(e);
            e.addComponent('collision', { type: 'mesh', model: model });

            const source = createShape.lastCall.args[0].sources[0];
            expect(source.scale.equals(new Vec3(6, 3, 3))).to.equal(true);
            expect(source.position.equals(new Vec3(0, 3, 0))).to.equal(true);
        });

        it('keeps the velocities of a dynamic body across a rebuild', function () {
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('rigidbody', { type: 'dynamic' });
            e.addComponent('collision', { type: 'mesh', convexHull: true, render: createRender() });
            e.rigidbody.linearVelocity = new Vec3(1, 2, 3);
            e.rigidbody.angularVelocity = new Vec3(4, 5, 6);

            const setLinear = spy(PhysicsBody.prototype, 'setLinearVelocity');
            const setAngular = spy(PhysicsBody.prototype, 'setAngularVelocity');

            e.setLocalScale(2, 2, 2);
            step();

            expect(setLinear.calledOnce).to.equal(true);
            expect(setLinear.firstCall.thisValue).to.equal(e.rigidbody._body);
            expect(setLinear.firstCall.args[0].equals(new Vec3(1, 2, 3))).to.equal(true);
            expect(setAngular.calledOnce).to.equal(true);
            expect(setAngular.firstCall.args[0].equals(new Vec3(4, 5, 6))).to.equal(true);
        });

        it('does not watch mesh components when the backend cannot scale mesh instances', function () {
            Object.defineProperty(world, 'supportsMeshScaling', { value: false });

            const e = createMeshEntity();
            const shape = e.collision.shape;
            expect(shape).to.exist;
            expect(app.systems.collision._meshComponents).to.have.lengthOf(0);

            e.setLocalScale(2, 2, 2);
            step();

            expect(e.collision.shape).to.equal(shape);
        });

    });

});
