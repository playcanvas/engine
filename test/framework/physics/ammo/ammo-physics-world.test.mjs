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
import { hasAmmo, loadAmmo } from '../../../ammo.mjs';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('AmmoPhysicsWorld', function () {
    let app;
    let world;

    // Loaded once per file - the module takes ~100 ms to initialize
    before(async function () {
        this.timeout(20000);

        if (!hasAmmo()) {
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

    describe('gravity', function () {

        it('applies the system gravity to the native world when installed', function () {
            app.systems.rigidbody.gravity.set(0, -3.7, 0);
            installWorld();

            const gravity = world.nativeWorld.getGravity();
            expect(gravity.x()).to.equal(0);
            expect(gravity.y()).to.be.closeTo(-3.7, 1e-6);
            expect(gravity.z()).to.equal(0);
        });

        it('applies a gravity change to the native world on the next step', function () {
            installWorld();
            app.systems.rigidbody.gravity.set(1, 0, 0);

            expect(world.nativeWorld.getGravity().x()).to.equal(0);

            step();

            expect(world.nativeWorld.getGravity().x()).to.equal(1);
        });
    });

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

        it('keeps a single cache entry and the same BVH while a collider is tweened', function () {
            const mesh = createCubeMesh();
            const e = createMeshEntity(mesh);
            const entry = world._triMeshCache.get(mesh.id);
            const bvhShape = Ammo.getPointer(entry.bvhShape);

            for (let i = 1; i <= 200; i++) {
                const scale = 1 + i / 200;
                e.setLocalScale(scale, scale, scale);
                step();
                expect(world._triMeshCache.size).to.equal(1);
            }

            // every rebuild dropped and re-took the only reference within the step, so the shared
            // BVH was never released
            expect(Ammo.getPointer(entry.bvhShape)).to.equal(bvhShape);
            expect(entry.refCount).to.equal(1);
            expect(hitHeightAt(0)).to.be.closeTo(1.0, 1e-3);
        });

        it('releases the shared BVH at the end of a step once no collider uses the mesh', function () {
            const mesh = createCubeMesh();
            const a = createMeshEntity(mesh, { x: 0 });
            const b = createMeshEntity(mesh, { x: 10, scale: 2 });
            const entry = world._triMeshCache.get(mesh.id);
            expect(entry.refCount).to.equal(2);

            a.destroy();
            step();

            // still wrapped by the second collider
            expect(entry.refCount).to.equal(1);
            expect(entry.bvhShape).to.exist;

            b.destroy();

            // released at the end of the next step, not immediately
            expect(entry.bvhShape).to.exist;
            step();
            expect(entry.refCount).to.equal(0);
            expect(entry.bvhShape).to.equal(null);

            // the triangle data stays cached and the BVH is rebuilt from it on next use
            expect(world._triMeshCache.size).to.equal(1);
            createMeshEntity(mesh, { x: 20, scale: 0.5 });
            expect(entry.bvhShape).to.exist;
            expect(entry.refCount).to.equal(1);
            expect(hitHeightAt(20)).to.be.closeTo(0.25, 1e-3);
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

    describe('contact normals', function () {

        // Regression tests for https://github.com/playcanvas/engine/issues/4547. Bullet reports one
        // normal per contact, on body B pointing toward body A, and which body is A follows the
        // order the bodies were added to the world. Each entity must nevertheless receive the
        // normal of the other entity's surface, so the sign cannot depend on that order.

        function createFloor() {
            const floor = new Entity('floor');
            floor.setPosition(0, -0.5, 0);
            floor.addComponent('collision', { type: 'box', halfExtents: new Vec3(5, 0.5, 5) });
            floor.addComponent('rigidbody', { type: 'static' });
            app.root.addChild(floor);
            return floor;
        }

        function createBox() {
            const box = new Entity('box');
            box.setPosition(0, 1, 0);
            box.addComponent('collision', { type: 'box', halfExtents: new Vec3(0.5, 0.5, 0.5) });
            box.addComponent('rigidbody', { type: 'dynamic', mass: 1 });
            app.root.addChild(box);
            return box;
        }

        /**
         * Lets the box drop onto the floor and returns the first contact normal each side reports.
         *
         * @param {Entity} box - The falling box.
         * @param {Entity} floor - The floor.
         * @returns {{ box: Vec3, floor: Vec3 }} The normals.
         */
        function firstContactNormals(box, floor) {
            const normals = {};
            box.collision.once('contact', (result) => {
                normals.box = result.contacts[0].normal.clone();
            });
            floor.collision.once('contact', (result) => {
                normals.floor = result.contacts[0].normal.clone();
            });
            for (let i = 0; i < 60 && !(normals.box && normals.floor); i++) {
                app.update(1 / 60);
            }
            expect(normals.box, 'box contact').to.exist;
            expect(normals.floor, 'floor contact').to.exist;
            return normals;
        }

        /**
         * Asserts that each side sees the normal of the other surface: the box rests on the
         * floor's top face, the floor is touched by the box's bottom face.
         *
         * @param {{ box: Vec3, floor: Vec3 }} normals - The normals returned by firstContactNormals.
         */
        function expectOtherSurfaceNormals(normals) {
            expect(normals.box.y).to.be.closeTo(1, 1e-3);
            expect(normals.floor.y).to.be.closeTo(-1, 1e-3);
        }

        it('gives each entity the normal of the other surface when the floor is added first', function () {
            installWorld();
            const floor = createFloor();
            const box = createBox();

            expectOtherSurfaceNormals(firstContactNormals(box, floor));
        });

        it('gives each entity the normal of the other surface when the box is added first', function () {
            installWorld();
            const box = createBox();
            const floor = createFloor();

            expectOtherSurfaceNormals(firstContactNormals(box, floor));
        });

        it('keeps the sign after the other body is disabled and re-enabled', function () {
            installWorld();
            const floor = createFloor();
            const box = createBox();

            expectOtherSurfaceNormals(firstContactNormals(box, floor));

            // re-adding the floor to the world changes which body Bullet reports first
            floor.enabled = false;
            box.rigidbody.linearVelocity = Vec3.ZERO;
            box.rigidbody.teleport(0, 1, 0);
            floor.enabled = true;

            expectOtherSurfaceNormals(firstContactNormals(box, floor));
        });

        it('reports the normal on entity B for the global contact event', function () {
            installWorld();
            createFloor();
            createBox();

            let result = null;
            app.systems.rigidbody.once('contact', (r) => {
                result = { b: r.b.name, normalY: r.normal.y };
            });
            for (let i = 0; i < 60; i++) {
                app.update(1 / 60);
            }

            expect(result).to.not.be.null;
            // the normal on B points away from B's surface: up off the floor, down off the box
            expect(result.normalY).to.be.closeTo(result.b === 'floor' ? 1 : -1, 1e-3);
        });
    });

    describe('compound children', function () {

        // Regression tests for https://github.com/playcanvas/engine/issues/3695 and
        // https://github.com/playcanvas/engine/issues/4623. A compound child's shape used to be
        // re-synced only when the compound root's own transform was dirty at physics time, so a
        // child moved on its own, by a script after being parented or by an animation, kept the
        // pose it joined with until the root was toggled.

        function createGround() {
            const ground = new Entity('ground');
            ground.addComponent('collision', { type: 'box', halfExtents: new Vec3(8, 0.5, 8) });
            ground.addComponent('rigidbody', { type: 'static' });
            app.root.addChild(ground);
            return ground;
        }

        function createCompound(bodyType = 'dynamic') {
            const compound = new Entity('compound');
            compound.setPosition(0, 3.5, 0);
            compound.addComponent('collision', { type: 'compound' });
            compound.addComponent('rigidbody', { type: bodyType, mass: 1 });
            app.root.addChild(compound);

            const first = new Entity('first');
            first.addComponent('collision', { type: 'sphere', radius: 0.5 });
            compound.addChild(first);
            return compound;
        }

        /**
         * Runs frames the way the application does: the update, then the hierarchy sync the
         * renderer performs, which clears the dirty flags the old sync relied on.
         *
         * @param {number} count - The number of frames.
         */
        function frames(count) {
            for (let i = 0; i < count; i++) {
                app.update(1 / 60);
                app.root.syncHierarchy();
            }
        }

        /**
         * Casts a ray straight down at x and returns the name of the entity it hits.
         *
         * @param {number} x - The world X position of the ray.
         * @returns {string|null} The hit entity name, or null on a miss.
         */
        function hitNameAt(x) {
            const result = app.systems.rigidbody.raycastFirst(new Vec3(x, 10, 0), new Vec3(x, -10, 0));
            return result ? result.entity.name : null;
        }

        it('moves a child shape repositioned after being parented, once the compound is at rest', function () {
            installWorld();
            createGround();
            const compound = createCompound();
            frames(240);
            expect(compound.rigidbody._body.isActive(), 'compound asleep').to.be.false;

            // the order the report used: component, parent, then position
            const child = new Entity('child');
            child.addComponent('collision', { type: 'sphere', radius: 0.5 });
            compound.addChild(child);
            child.setLocalPosition(2, 0, 0);
            frames(1);

            expect(world.getCompoundChildCount(compound.collision.shape)).to.equal(2);
            expect(hitNameAt(2)).to.equal('compound');
        });

        it('moves an existing child shape when the child is repositioned while the compound rests', function () {
            installWorld();
            createGround();
            const compound = createCompound();
            frames(240);

            compound.findByName('first').setLocalPosition(2, 0, 0);
            frames(1);

            expect(hitNameAt(2)).to.equal('compound');
            expect(hitNameAt(0)).to.equal('ground');
        });

        it('follows a child moved every frame', function () {
            installWorld();
            createGround();
            const compound = createCompound('kinematic');
            const first = compound.findByName('first');

            for (let x = 1; x <= 3; x++) {
                first.setLocalPosition(x, 0, 0);
                frames(1);
                expect(hitNameAt(x)).to.equal('compound');
            }
        });

        it('follows a child whose intermediate parent moves', function () {
            installWorld();
            createGround();
            const compound = createCompound('kinematic');

            const sub = new Entity('sub');
            sub.setLocalPosition(1, 0, 0);
            compound.addChild(sub);
            const grandchild = new Entity('grandchild');
            sub.addChild(grandchild);
            grandchild.addComponent('collision', { type: 'sphere', radius: 0.5 });
            frames(1);
            expect(hitNameAt(1)).to.equal('compound');

            // the moved node has no collision component of its own
            sub.setLocalPosition(3, 0, 0);
            frames(1);

            expect(hitNameAt(3)).to.equal('compound');
            expect(hitNameAt(1)).to.equal('ground');
        });

        it('writes nothing to the compound while only the root moves', function () {
            installWorld();
            createGround();
            const compound = createCompound();
            const update = spy(world, 'updateCompoundChild');

            // falling: the root moves every frame, the child does not
            frames(30);

            expect(compound.getPosition().y).to.be.below(3.4);
            expect(update.called).to.be.false;
        });

        it('adopts a collision descendant parented deep inside a subtree', function () {
            installWorld();
            createGround();
            const compound = createCompound('kinematic');

            // built detached, so the grandchild starts out as a trigger
            const sub = new Entity('sub');
            sub.setLocalPosition(2, 0, 0);
            const grandchild = new Entity('grandchild');
            grandchild.addComponent('collision', { type: 'sphere', radius: 0.5 });
            sub.addChild(grandchild);
            expect(grandchild.trigger).to.exist;

            // the insert hook only sees the inserted node, which has no collision component; the
            // grandchild becoming active in the hierarchy wires it instead
            compound.addChild(sub);

            expect(grandchild.trigger).to.be.undefined;
            expect(grandchild.collision._compoundParent).to.equal(compound.collision);
            expect(world.getCompoundChildCount(compound.collision.shape)).to.equal(2);

            frames(1);

            expect(hitNameAt(2)).to.equal('compound');
        });

        it('adopts a collision descendant of a compound that is enabled later', function () {
            installWorld();
            createGround();
            const compound = createCompound('kinematic');
            compound.enabled = false;

            const sub = new Entity('sub');
            sub.setLocalPosition(2, 0, 0);
            const grandchild = new Entity('grandchild');
            grandchild.addComponent('collision', { type: 'sphere', radius: 0.5 });
            sub.addChild(grandchild);
            compound.addChild(sub);

            compound.enabled = true;
            frames(1);

            expect(grandchild.collision._compoundParent).to.equal(compound.collision);
            expect(hitNameAt(2)).to.equal('compound');
        });

        it('does not rebuild a directly inserted child twice', function () {
            installWorld();
            createGround();
            const compound = createCompound('kinematic');
            const rebuild = spy(app.systems.collision, 'recreatePhysicalShapes');

            const child = new Entity('child');
            child.setLocalPosition(2, 0, 0);
            child.addComponent('collision', { type: 'sphere', radius: 0.5 });
            rebuild.resetHistory();
            compound.addChild(child);

            // once from onEnable when it becomes active under the compound; the insert hook
            // then finds it in place
            expect(rebuild.callCount).to.equal(1);
            frames(1);
            expect(hitNameAt(2)).to.equal('compound');
        });

        it('tracks the children of dynamic and kinematic compounds only', function () {
            installWorld();
            const tracked = app.systems.rigidbody._compounds;
            const dynamic = createCompound('dynamic');
            const kinematic = createCompound('kinematic');
            const fixed = createCompound('static');

            expect(tracked).to.include(dynamic.collision);
            expect(tracked).to.include(kinematic.collision);
            expect(tracked).to.not.include(fixed.collision);
        });
    });

    describe('internal tick callback', function () {

        // Regression tests for https://github.com/playcanvas/engine/issues/9279. Emscripten's
        // addFunction never frees a table slot and identity-caches the function it is given, so
        // the backend registers one dispatcher per Ammo instance and routes by the world pointer
        // Bullet passes, instead of one closure per world that kept the world, and through it the
        // whole application, reachable for the life of the page.

        /**
         * Drops a box onto a ground plane in the given application and records the names of the
         * entities the box reports contacts with.
         *
         * @param {import('../../../../src/framework/app-base.js').AppBase} application - The application.
         * @param {string} name - A prefix for the entity names.
         * @returns {string[]} The recorded contact names, filled as the application updates.
         */
        function dropBox(application, name) {
            const ground = new Entity(`${name}-ground`, application);
            ground.addComponent('collision', { type: 'box', halfExtents: new Vec3(5, 0.5, 5) });
            ground.addComponent('rigidbody', { type: 'static' });
            application.root.addChild(ground);

            const box = new Entity(`${name}-box`, application);
            box.setPosition(0, 1, 0);
            box.addComponent('collision', { type: 'box', halfExtents: new Vec3(0.2, 0.2, 0.2) });
            box.addComponent('rigidbody', { type: 'dynamic', mass: 1 });
            application.root.addChild(box);

            const contacts = [];
            box.collision.on('contact', (result) => {
                contacts.push(result.other.name);
            });
            return contacts;
        }

        function settle(application, frames = 60) {
            for (let i = 0; i < frames; i++) {
                application.update(1 / 60);
            }
        }

        it('registers a single table entry however many worlds are created', function () {
            // the shared dispatcher exists from the first world on
            installWorld();

            const before = Ammo.addFunction(() => {}, 'vif');
            const worlds = [new AmmoPhysicsWorld(), new AmmoPhysicsWorld(), new AmmoPhysicsWorld()];
            const after = Ammo.addFunction(() => {}, 'vif');
            worlds.forEach(w => w.destroy());

            // two probe functions land in consecutive slots only if nothing was added in between
            expect(after - before).to.equal(1);
        });

        it('routes contacts to the world they occur in while several worlds are alive', function () {
            installWorld();
            const other = createApp();
            other.systems.rigidbody.setPhysicsWorld(new AmmoPhysicsWorld());
            try {
                const first = dropBox(app, 'first');
                const second = dropBox(other, 'second');
                settle(app);
                settle(other);

                expect(first).to.not.be.empty;
                expect(second).to.not.be.empty;
                expect(first.every(name => name === 'first-ground')).to.be.true;
                expect(second.every(name => name === 'second-ground')).to.be.true;
            } finally {
                other.destroy();
            }
        });

        it('keeps routing after a sibling world is destroyed and another is created', function () {
            installWorld();
            const sibling = createApp();
            sibling.systems.rigidbody.setPhysicsWorld(new AmmoPhysicsWorld());
            sibling.destroy();

            const replacement = createApp();
            replacement.systems.rigidbody.setPhysicsWorld(new AmmoPhysicsWorld());
            try {
                const survivor = dropBox(app, 'survivor');
                const fresh = dropBox(replacement, 'fresh');
                settle(app);
                settle(replacement);

                expect(survivor).to.not.be.empty;
                expect(fresh).to.not.be.empty;
                expect(survivor.every(name => name === 'survivor-ground')).to.be.true;
                expect(fresh.every(name => name === 'fresh-ground')).to.be.true;
            } finally {
                replacement.destroy();
            }
        });

        const tick = () => new Promise((resolve) => {
            setTimeout(resolve, 0);
        });

        /**
         * Runs the garbage collector until the referent is gone or the attempts run out. A deref
         * keeps its target alive for the rest of the current job, so gc and deref must run in
         * different jobs.
         *
         * @param {WeakRef<object>} ref - The reference to watch.
         * @param {number} [attempts] - How many collections to try.
         * @returns {Promise<boolean>} True once the referent has been collected.
         */
        async function collected(ref, attempts = 10) {
            if (attempts === 0) {
                return false;
            }
            global.gc();
            await tick();
            const alive = ref.deref() !== undefined;
            await tick();
            return alive ? collected(ref, attempts - 1) : true;
        }

        /**
         * Builds, simulates and destroys an application and returns a weak reference to it.
         *
         * @param {boolean} withWorld - Whether to install an Ammo world.
         * @returns {WeakRef<object>} The reference.
         */
        function destroyedApplication(withWorld) {
            let candidate = createApp();
            if (withWorld) {
                candidate.systems.rigidbody.setPhysicsWorld(new AmmoPhysicsWorld());
            }
            dropBox(candidate, 'collected');
            settle(candidate, 30);
            const ref = new WeakRef(candidate);
            candidate.destroy();
            candidate = null;
            return ref;
        }

        it('lets a destroyed application be garbage collected', async function () {
            if (typeof global.gc !== 'function') {
                this.skip();
            }
            this.timeout(20000);

            // the harness itself has to let an application go before the Ammo case means anything
            expect(await collected(destroyedApplication(false)), 'without a physics world').to.be.true;
            expect(await collected(destroyedApplication(true)), 'with an Ammo world').to.be.true;
        });
    });

    describe('shape lifetime', function () {

        // Every native shape a collision component creates must be destroyed with it. Shapes are
        // tracked by pointer because Ammo hands out a fresh wrapper object per lookup.

        beforeEach(function () {
            installWorld();
        });

        /**
         * Wraps every Ammo shape constructor and Ammo.destroy to track the live native shapes.
         *
         * @returns {Map<number, string>} Live shape pointers mapped to their class names.
         */
        function trackShapes() {
            const live = new Map();

            Object.keys(Ammo)
            .filter(name => /Shape/.test(name) && typeof Ammo[name] === 'function')
            .forEach((name) => {
                const Original = Ammo[name];
                stub(Ammo, name).callsFake((...args) => {
                    const shape = new Original(...args);
                    live.set(Ammo.getPointer(shape), name);
                    return shape;
                });
            });

            const destroy = Ammo.destroy;
            stub(Ammo, 'destroy').callsFake((obj) => {
                live.delete(Ammo.getPointer(obj));
                destroy(obj);
            });

            return live;
        }

        /**
         * @param {Map<number, string>} live - The live shapes.
         * @returns {string[]} The sorted class names of the live shapes.
         */
        function liveNames(live) {
            return [...live.values()].sort();
        }

        const primitives = {
            box: { type: 'box' },
            sphere: { type: 'sphere' },
            'capsule (x)': { type: 'capsule', axis: 0 },
            'capsule (y)': { type: 'capsule', axis: 1 },
            'capsule (z)': { type: 'capsule', axis: 2 },
            'cylinder (x)': { type: 'cylinder', axis: 0 },
            'cylinder (y)': { type: 'cylinder', axis: 1 },
            'cylinder (z)': { type: 'cylinder', axis: 2 },
            'cone (x)': { type: 'cone', axis: 0 },
            'cone (y)': { type: 'cone', axis: 1 },
            'cone (z)': { type: 'cone', axis: 2 },
            compound: { type: 'compound' }
        };

        Object.keys(primitives).forEach((name) => {
            it(`destroys a ${name} shape with its component`, function () {
                const live = trackShapes();

                const e = new Entity();
                app.root.addChild(e);
                e.addComponent('collision', primitives[name]);
                expect(live.size).to.equal(1);

                e.removeComponent('collision');
                expect(liveNames(live)).to.deep.equal([]);
            });
        });

        it('destroys the previous shape when a primitive is rebuilt', function () {
            const live = trackShapes();

            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('collision', { type: 'box' });
            e.addComponent('rigidbody', { type: 'static' });

            // the old shape is destroyed before the new one is created, so the two may share an
            // address; a leak shows up as a second live shape
            e.collision.halfExtents = new Vec3(1, 2, 3);
            expect(liveNames(live)).to.deep.equal(['btBoxShape']);

            e.collision.type = 'sphere';
            expect(liveNames(live)).to.deep.equal(['btSphereShape']);

            e.destroy();
            expect(liveNames(live)).to.deep.equal([]);
        });

        it('destroys a triangle mesh with its component and the BVH after the step', function () {
            const live = trackShapes();

            const mesh = createCubeMesh();
            const e = createMeshEntity(mesh);
            expect(liveNames(live)).to.deep.equal([
                'btBvhTriangleMeshShape', 'btCompoundShape', 'btScaledBvhTriangleMeshShape'
            ]);

            // the shared BVH outlives the wrapper until the step, so a collider rebuilt within a
            // frame can wrap it again
            e.removeComponent('collision');
            expect(liveNames(live)).to.deep.equal(['btBvhTriangleMeshShape']);

            step();
            expect(liveNames(live)).to.deep.equal([]);
        });

        it('keeps the shared BVH while another collider still wraps it', function () {
            const live = trackShapes();

            const mesh = createCubeMesh();
            const a = createMeshEntity(mesh, { x: 0 });
            createMeshEntity(mesh, { x: 10 });
            expect(liveNames(live)).to.deep.equal([
                'btBvhTriangleMeshShape',
                'btCompoundShape', 'btCompoundShape',
                'btScaledBvhTriangleMeshShape', 'btScaledBvhTriangleMeshShape'
            ]);

            a.destroy();
            step();
            expect(liveNames(live)).to.deep.equal([
                'btBvhTriangleMeshShape', 'btCompoundShape', 'btScaledBvhTriangleMeshShape'
            ]);
        });

        it('destroys a convex hull with its component', function () {
            const live = trackShapes();

            const mesh = createCubeMesh();
            const e = createMeshEntity(mesh, { convexHull: true });
            expect(liveNames(live)).to.deep.equal(['btCompoundShape', 'btConvexHullShape']);

            e.removeComponent('collision');
            expect(liveNames(live)).to.deep.equal([]);
        });

        it('destroys a compound and the shapes of its children with the entity', function () {
            const live = trackShapes();

            const root = new Entity();
            app.root.addChild(root);
            root.addComponent('rigidbody', { type: 'static' });
            root.addComponent('collision', { type: 'compound' });

            const child = new Entity();
            root.addChild(child);
            child.addComponent('collision', { type: 'box' });
            expect(liveNames(live)).to.deep.equal(['btBoxShape', 'btCompoundShape']);

            root.destroy();
            expect(liveNames(live)).to.deep.equal([]);
        });

        it('destroys every shape with the world', function () {
            const live = trackShapes();

            const mesh = createCubeMesh();
            createMeshEntity(mesh);
            createMeshEntity(mesh, { x: 10, convexHull: true });
            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('collision', { type: 'capsule' });
            expect(live.size).to.equal(6);

            app.destroy();
            app = null;
            expect(liveNames(live)).to.deep.equal([]);
        });
    });

    describe('rigid body removal', function () {

        // End-to-end checks for https://github.com/playcanvas/engine/issues/2195: a collision
        // component whose rigid body is removed acts as a trigger from then on.

        /**
         * Drops a ball onto a solid block sitting on a floor and lets it settle. Returns the
         * block, the ball and the names the block reports through triggerenter.
         *
         * @returns {{ zone: Entity, ball: Entity, entered: string[] }} The scene.
         */
        function settleBallOnBlock() {
            installWorld();

            const floor = new Entity('floor');
            floor.setPosition(0, -0.5, 0);
            floor.addComponent('collision', { type: 'box', halfExtents: new Vec3(5, 0.5, 5) });
            floor.addComponent('rigidbody', { type: 'static' });
            app.root.addChild(floor);

            const zone = new Entity('zone');
            zone.setPosition(0, 0.5, 0);
            zone.addComponent('collision', { type: 'box', halfExtents: new Vec3(1, 0.5, 1) });
            zone.addComponent('rigidbody', { type: 'static' });
            app.root.addChild(zone);

            const ball = new Entity('ball');
            ball.setPosition(0, 3, 0);
            ball.addComponent('collision', { type: 'sphere', radius: 0.25 });
            ball.addComponent('rigidbody', { type: 'dynamic', mass: 1 });
            ball.collision.on('contact', () => {});
            app.root.addChild(ball);

            // the block listens for contacts as a body and for triggers afterwards, so the pair the
            // ball rests in is recorded on the block's side the way a game switching roles would
            zone.collision.on('collisionstart', () => {});
            const entered = [];
            zone.collision.on('triggerenter', (other) => {
                entered.push(other.name);
            });

            for (let i = 0; i < 90; i++) app.update(1 / 60);
            expect(entered).to.deep.equal([]);
            expect(ball.getPosition().y).to.be.above(1.2);

            return { zone, ball, entered };
        }

        it('fires trigger events once the rigid body is removed', function () {
            const { zone, ball, entered } = settleBallOnBlock();

            // the block becomes a volume the ball falls through and is reported by
            zone.removeComponent('rigidbody');
            ball.rigidbody.linearVelocity = Vec3.ZERO;
            ball.rigidbody.teleport(0, 3, 0);

            for (let i = 0; i < 120; i++) app.update(1 / 60);
            expect(entered).to.deep.equal(['ball']);
            expect(ball.getPosition().y).to.be.below(0.5);
        });

        it('reports an overlap that was already in progress when the body became a trigger', function () {
            const { zone, ball, entered } = settleBallOnBlock();

            // the ball stays where it rests, so the very first trigger step sees it overlapping
            zone.removeComponent('rigidbody');

            for (let i = 0; i < 5; i++) app.update(1 / 60);
            expect(entered).to.deep.equal(['ball']);

            for (let i = 0; i < 120; i++) app.update(1 / 60);
            expect(ball.getPosition().y).to.be.below(0.5);
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
