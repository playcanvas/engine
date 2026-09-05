import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

import { expect } from 'chai';
import { restore, spy, stub } from 'sinon';

import { Debug } from '../../../../src/core/debug.js';
import { Vec3 } from '../../../../src/core/math/vec3.js';
import { Entity } from '../../../../src/framework/entity.js';
import { AmmoPhysicsWorld } from '../../../../src/framework/physics/ammo/ammo-physics-world.js';
import { BoxGeometry } from '../../../../src/scene/geometry/box-geometry.js';
import { GraphNode } from '../../../../src/scene/graph-node.js';
import { Mesh } from '../../../../src/scene/mesh.js';
import { Model } from '../../../../src/scene/model.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

// The Ammo.js build shipped with the examples doubles as the build these tests run against. It
// lives outside the test tree, so the suite is skipped when it is absent.
const AMMO_PATH = resolve('examples/assets/wasm/ammo/ammo.js');

/**
 * Loads the asm.js Ammo build headlessly and resolves with the initialized module.
 *
 * @returns {Promise<object>} The Ammo module.
 */
function loadAmmo() {
    // the build is a UMD script that cannot be imported from an ES module package, so it is
    // evaluated as a CommonJS module body with the globals its Node code path expects
    const source = readFileSync(AMMO_PATH, 'utf8');
    const module = { exports: {} };
    // eslint-disable-next-line no-new-func
    const evaluate = new Function('module', 'exports', 'require', '__dirname', '__filename', source);
    evaluate(module, module.exports, createRequire(import.meta.url), dirname(AMMO_PATH), AMMO_PATH);
    return module.exports();
}

describe('AmmoPhysicsWorld', function () {
    let app;
    let world;

    // Loaded once per file - the module takes ~100 ms to initialize
    before(async function () {
        this.timeout(20000);

        if (!existsSync(AMMO_PATH)) {
            this.skip();
        }

        globalThis.Ammo = await loadAmmo();

        if (typeof Ammo.btScaledBvhTriangleMeshShape !== 'function') {
            delete globalThis.Ammo;
            this.skip();
        }
    });

    after(function () {
        delete globalThis.Ammo;
    });

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        restore();
        app?.destroy();
        app = null;
        world = null;
        jsdomTeardown();
    });

    /**
     * Installs a fresh Ammo backend into the application.
     */
    function installWorld() {
        world = new AmmoPhysicsWorld();
        app.systems.rigidbody.setPhysicsWorld(world);
    }

    /**
     * Creates a unit cube mesh (half extents 0.5) with real vertex and index buffers.
     *
     * @returns {Mesh} The mesh.
     */
    function createCubeMesh() {
        return Mesh.fromGeometry(app.graphicsDevice, new BoxGeometry());
    }

    /**
     * Creates a static entity with a mesh collider built from a render source.
     *
     * @param {Mesh} mesh - The collision mesh.
     * @param {object} [options] - Placement options.
     * @param {number} [options.x] - The world X position.
     * @param {number} [options.scale] - The uniform local scale.
     * @param {boolean} [options.convexHull] - Build a convex hull instead of a triangle mesh.
     * @param {Entity} [options.parent] - The parent entity.
     * @param {boolean} [options.rigidbody] - Whether to add a static rigid body.
     * @returns {Entity} The entity.
     */
    function createMeshEntity(mesh, { x = 0, scale = 1, convexHull = false, parent = app.root, rigidbody = true } = {}) {
        const e = new Entity();
        e.setLocalPosition(x, 0, 0);
        e.setLocalScale(scale, scale, scale);
        parent.addChild(e);
        if (rigidbody) {
            e.addComponent('rigidbody', { type: 'static' });
        }
        e.addComponent('collision', {
            type: 'mesh',
            convexHull: convexHull,
            render: { meshes: [mesh] }
        });
        return e;
    }

    /**
     * Casts a ray straight down at x and returns the hit height, or null on a miss.
     *
     * @param {number} x - The world X position of the ray.
     * @returns {number|null} The hit height.
     */
    function hitHeightAt(x) {
        const result = app.systems.rigidbody.raycastFirst(new Vec3(x, 10, 0), new Vec3(x, -10, 0));
        return result ? result.point.y : null;
    }

    /**
     * Advances the simulation by one fixed step.
     */
    function step() {
        app.systems.rigidbody.step(1 / 60);
    }

    describe('mesh shape scaling', function () {

        beforeEach(function () {
            installWorld();
        });

        it('reports mesh scaling support', function () {
            expect(world.supportsMeshScaling).to.equal(true);
        });

        it('gives colliders sharing a mesh their own scale', function () {
            const mesh = createCubeMesh();
            createMeshEntity(mesh, { x: 0, scale: 1 });
            createMeshEntity(mesh, { x: 10, scale: 2 });
            createMeshEntity(mesh, { x: 20, scale: 0.5 });

            expect(hitHeightAt(0)).to.be.closeTo(0.5, 1e-3);
            expect(hitHeightAt(10)).to.be.closeTo(1.0, 1e-3);
            expect(hitHeightAt(20)).to.be.closeTo(0.25, 1e-3);
            expect(hitHeightAt(0.75)).to.equal(null);
        });

        it('shares one set of triangle data and one BVH between scaled instances', function () {
            const mesh = createCubeMesh();
            const a = createMeshEntity(mesh, { x: 0, scale: 1 });
            const b = createMeshEntity(mesh, { x: 10, scale: 2 });

            expect(world._triMeshCache.size).to.equal(1);
            const entry = world._triMeshCache.get(mesh.id);
            expect(entry.bvhShape).to.exist;

            // each collider wraps the shared BVH shape in its own scaled instance (the compound
            // hands back base class wrappers, hence the casts)
            const wrapperA = Ammo.castObject(a.collision.shape.getChildShape(0), Ammo.btScaledBvhTriangleMeshShape);
            const wrapperB = Ammo.castObject(b.collision.shape.getChildShape(0), Ammo.btScaledBvhTriangleMeshShape);
            expect(Ammo.getPointer(wrapperA.getChildShape())).to.equal(Ammo.getPointer(entry.bvhShape));
            expect(Ammo.getPointer(wrapperB.getChildShape())).to.equal(Ammo.getPointer(entry.bvhShape));
            expect(wrapperB.getLocalScaling().x()).to.be.closeTo(2, 1e-6);

            // and the shared shape itself is never scaled
            expect(entry.bvhShape.getLocalScaling().x()).to.equal(1);
        });

        it('never scales the shared shapes through setLocalScaling', function () {
            const bvhScaling = spy(Ammo.btBvhTriangleMeshShape.prototype, 'setLocalScaling');
            const compoundScaling = spy(Ammo.btCompoundShape.prototype, 'setLocalScaling');

            const mesh = createCubeMesh();
            createMeshEntity(mesh, { x: 0, scale: 1 });
            createMeshEntity(mesh, { x: 10, scale: 2 });

            expect(bvhScaling.called).to.equal(false);
            expect(compoundScaling.called).to.equal(false);
        });

        it('rebuilds a collider at the start of the next step when its entity is rescaled', function () {
            const mesh = createCubeMesh();
            const a = createMeshEntity(mesh, { x: 0, scale: 1 });
            createMeshEntity(mesh, { x: 10, scale: 2 });

            a.setLocalScale(3, 3, 3);

            // nothing changes until the physics step
            expect(hitHeightAt(0)).to.be.closeTo(0.5, 1e-3);

            step();

            expect(hitHeightAt(0)).to.be.closeTo(1.5, 1e-3);
            expect(hitHeightAt(10)).to.be.closeTo(1.0, 1e-3);
        });

        it('rebuilds a collider when an ancestor is rescaled', function () {
            const parent = new Entity();
            app.root.addChild(parent);

            const mesh = createCubeMesh();
            createMeshEntity(mesh, { parent });

            parent.setLocalScale(2, 2, 2);
            step();

            expect(hitHeightAt(0)).to.be.closeTo(1.0, 1e-3);
        });

        it('keeps a single cache entry while a collider is tweened', function () {
            const mesh = createCubeMesh();
            const e = createMeshEntity(mesh);

            for (let i = 1; i <= 200; i++) {
                const scale = 1 + i / 200;
                e.setLocalScale(scale, scale, scale);
                step();
                expect(world._triMeshCache.size).to.equal(1);
            }

            expect(hitHeightAt(0)).to.be.closeTo(1.0, 1e-3);
        });

        it('applies the node and entity scale of a model source', function () {
            const mesh = createCubeMesh();

            // a model whose single node sits 1 unit up and is scaled by 2 - the collision system
            // only reads the mesh and node of a mesh instance, so a plain object stands in
            const createModel = () => {
                const model = new Model();
                model.graph = new GraphNode();
                const node = new GraphNode();
                node.setLocalPosition(0, 1, 0);
                node.setLocalScale(2, 2, 2);
                model.graph.addChild(node);
                model.meshInstances = [{ mesh, node }];
                return model;
            };

            const addModelEntity = (x, scale) => {
                const e = new Entity();
                e.setLocalPosition(x, 0, 0);
                e.setLocalScale(scale, scale, scale);
                app.root.addChild(e);
                e.addComponent('rigidbody', { type: 'static' });
                e.addComponent('collision', { type: 'mesh', model: createModel() });
                return e;
            };

            // node scale 2 makes the cube 2 units tall around its centre at y = 1 * entity scale
            addModelEntity(0, 1);
            addModelEntity(10, 2);

            expect(hitHeightAt(0)).to.be.closeTo(2.0, 1e-3);
            expect(hitHeightAt(10)).to.be.closeTo(4.0, 1e-3);
        });

        it('rebuilds a compound child in place when the compound root is rescaled', function () {
            const root = new Entity();
            app.root.addChild(root);
            root.addComponent('rigidbody', { type: 'static' });
            root.addComponent('collision', { type: 'compound' });

            const mesh = createCubeMesh();
            const child = createMeshEntity(mesh, { parent: root, rigidbody: false });
            expect(child.collision._compoundParent).to.equal(root.collision);
            expect(child.trigger).to.equal(undefined);

            const compound = Ammo.getPointer(root.collision.shape);
            expect(hitHeightAt(0)).to.be.closeTo(0.5, 1e-3);

            root.setLocalScale(2, 2, 2);
            step();

            // the rebuilt child shape went back into the same compound, on the same body
            expect(hitHeightAt(0)).to.be.closeTo(1.0, 1e-3);
            expect(Ammo.getPointer(root.collision.shape)).to.equal(compound);
            expect(root.collision.shape.getNumChildShapes()).to.equal(1);
            expect(root.rigidbody._body).to.exist;
            expect(child.rigidbody).to.equal(undefined);
            expect(child.trigger).to.equal(undefined);
        });

        it('rebuilds a convex hull when its entity is rescaled', function () {
            const mesh = createCubeMesh();
            const e = createMeshEntity(mesh, { convexHull: true });

            // hull ray casts land on the collision margin, hence the looser tolerance
            expect(hitHeightAt(0)).to.be.closeTo(0.5, 0.05);

            e.setLocalScale(2, 2, 2);
            step();

            expect(hitHeightAt(0)).to.be.closeTo(1.0, 0.05);
        });

        it('frees the shared triangle data with the world', function () {
            const mesh = createCubeMesh();
            createMeshEntity(mesh);

            const entry = world._triMeshCache.get(mesh.id);
            const destroy = spy(Ammo, 'destroy');

            app.destroy();
            app = null;

            expect(destroy.calledWith(entry.bvhShape)).to.equal(true);
            expect(destroy.calledWith(entry.triMesh)).to.equal(true);
        });

    });

    describe('legacy Ammo build', function () {
        let scaledShape;

        beforeEach(function () {
            // hide the binding - a world constructed now behaves like one on an older build
            scaledShape = Ammo.btScaledBvhTriangleMeshShape;
            Ammo.btScaledBvhTriangleMeshShape = undefined;
            installWorld();
        });

        afterEach(function () {
            Ammo.btScaledBvhTriangleMeshShape = scaledShape;
        });

        it('reports no mesh scaling support and watches nothing', function () {
            expect(world.supportsMeshScaling).to.equal(false);

            const mesh = createCubeMesh();
            const e = createMeshEntity(mesh, { scale: 2 });

            expect(app.systems.collision._meshComponents).to.have.lengthOf(0);

            // rescaling the entity leaves the collider alone
            e.setLocalScale(3, 3, 3);
            step();
            expect(hitHeightAt(0)).to.be.closeTo(1.0, 1e-3);
        });

        it('bakes the scale of the first collider into the shared triangle data', function () {
            Debug._loggedMessages.clear();
            const warn = stub(console, 'warn');

            const mesh = createCubeMesh();
            createMeshEntity(mesh, { x: 0, scale: 2 });
            createMeshEntity(mesh, { x: 10, scale: 1 });

            // a single scaled collider is correct, a second one at another scale inherits it
            expect(hitHeightAt(0)).to.be.closeTo(1.0, 1e-3);
            expect(hitHeightAt(10)).to.be.closeTo(1.0, 1e-3);

            expect(warn.calledOnce).to.equal(true);
            expect(warn.firstCall.args[0]).to.match(/btScaledBvhTriangleMeshShape/);
        });

    });

});
