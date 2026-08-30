import { expect } from 'chai';

import { Vec3 } from '../../../src/core/math/vec3.js';
import { BoundingSphere } from '../../../src/core/shape/bounding-sphere.js';
import { Entity } from '../../../src/framework/entity.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * @import { Application } from '../../../src/framework/application.js'
 * @import { Light } from '../../../src/scene/light.js'
 * @import { MeshInstance } from '../../../src/scene/mesh-instance.js'
 */

const RANGE = 100;

describe('ShadowRendererLocal', function () {
    /** @type {Application} */
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
     * @param {Vec3} position - The light position.
     * @param {string} [type] - The light type.
     * @returns {Light} The light.
     */
    const createLight = (position, type = 'omni') => {
        const entity = new Entity();
        entity.addComponent('light', {
            type: type,
            range: RANGE,
            castShadows: true
        });
        entity.setPosition(position);
        app.root.addChild(entity);
        return entity.light.light;
    };

    /**
     * @param {Vec3} position - The caster position.
     * @param {number|Vec3} scale - The caster scale, uniform or per axis.
     * @returns {MeshInstance} The caster's mesh instance.
     */
    const createCaster = (position, scale) => {
        const entity = new Entity();
        entity.addComponent('render', { type: 'box' });
        entity.setPosition(position);
        if (scale instanceof Vec3) {
            entity.setLocalScale(scale);
        } else {
            entity.setLocalScale(scale, scale, scale);
        }
        app.root.addChild(entity);
        return entity.render.meshInstances[0];
    };

    /**
     * Culls the casters for the light and returns, for each of the six faces, the set of visible
     * casters.
     *
     * @param {Light} light - The light.
     * @param {MeshInstance[]} casters - The casters.
     * @returns {Set<MeshInstance>[]} The visible casters per face.
     */
    const cullFaces = (light, casters) => {
        app.renderer._shadowRendererLocal.cull(light, app.scene.layers, casters);
        const faces = [];
        for (let face = 0; face < light.numShadowFaces; face++) {
            faces.push(new Set(light.getRenderData(null, face).visibleCasters));
        }
        return faces;
    };

    /**
     * Maps the per-face sets of visible casters to per-face arrays of indices into the caster list,
     * so that assertions are made on plain numbers. A failed assertion holding a MeshInstance makes
     * chai walk the entire engine object graph to build its message.
     *
     * @param {Set<MeshInstance>[]} faces - The visible casters per face.
     * @param {MeshInstance[]} casters - The casters.
     * @returns {number[][]} The visible caster indices per face.
     */
    const faceIndices = (faces, casters) => {
        return faces.map(face => casters.filter(c => face.has(c)).map(c => casters.indexOf(c)));
    };

    /**
     * The set of casters each face's shadow camera frustum reports as visible - the test's
     * reference for what the single pass classification should produce.
     *
     * @param {Light} light - The light.
     * @param {MeshInstance[]} casters - The casters.
     * @returns {Set<MeshInstance>[]} The visible casters per face.
     */
    const referenceFaces = (light, casters) => {
        const faces = [];
        for (let face = 0; face < light.numShadowFaces; face++) {
            const camera = light.getRenderData(null, face).shadowCamera;
            const visible = new Set();
            for (const caster of casters) {
                if (camera.frustum.containsAabb(caster.aabb)) {
                    visible.add(caster);
                }
            }
            faces.push(visible);
        }
        return faces;
    };

    /**
     * A caster is provably outside every face frustum when its bounding box does not reach the axis
     * aligned cube the union of the six frusta is bounded by. Used to confirm the casters the
     * single pass classification drops - but a per-plane frustum test keeps - genuinely cannot
     * render into any face.
     *
     * @param {Light} light - The light.
     * @param {MeshInstance} caster - The caster.
     * @returns {boolean} True when the caster cannot intersect any face frustum.
     */
    const outsideAllFaces = (light, caster) => {
        const shadowCam = light.getRenderData(null, 0).shadowCamera;
        const half = shadowCam.farClip * Math.tan(shadowCam.fov * 0.5 * Math.PI / 180);
        const center = caster.aabb.center;
        const halfExtents = caster._aabb.halfExtents;
        const lightPos = light._node.getPosition();
        for (const axis of ['x', 'y', 'z']) {
            if (Math.abs(center[axis] - lightPos[axis]) - halfExtents[axis] > half) {
                return true;
            }
        }
        return false;
    };

    describe('#cull - omni', function () {

        it('places a caster at the light in all six faces', function () {
            const light = createLight(new Vec3(10, 20, 30));
            const caster = createCaster(new Vec3(10, 20, 30), 1);

            const faces = cullFaces(light, [caster]);
            expect(faces).to.have.lengthOf(6);
            faces.forEach(face => expect(face.has(caster)).to.equal(true));
        });

        it('places a caster on a single axis in that face only', function () {
            const light = createLight(new Vec3(0, 0, 0));
            const casters = [
                createCaster(new Vec3(50, 0, 0), 1),
                createCaster(new Vec3(-50, 0, 0), 1),
                createCaster(new Vec3(0, 50, 0), 1),
                createCaster(new Vec3(0, -50, 0), 1),
                createCaster(new Vec3(0, 0, 50), 1),
                createCaster(new Vec3(0, 0, -50), 1)
            ];

            const indices = faceIndices(cullFaces(light, casters), casters);

            // face order is +X, -X, +Y, -Y, +Z, -Z - see LightCamera.pointLightRotations
            for (let face = 0; face < 6; face++) {
                expect(indices[face], `face ${face}`).to.eql([face]);
            }
        });

        it('excludes a caster outside the light range', function () {
            const light = createLight(new Vec3(0, 0, 0));
            const caster = createCaster(new Vec3(RANGE * 3, 0, 0), 1);

            const faces = cullFaces(light, [caster]);
            faces.forEach(face => expect(face.size).to.equal(0));
        });

        it('includes a caster in a frustum corner, past the range sphere but inside the range cube', function () {
            const light = createLight(new Vec3(0, 0, 0));

            // 1.48 * range from the light, so a range *sphere* rejection would drop it, but its
            // extent along each axis is within the range and it is inside the +X face frustum
            const caster = createCaster(new Vec3(RANGE * 0.95, RANGE * 0.8, RANGE * 0.8), 1);

            const faces = cullFaces(light, [caster]);
            expect(caster.aabb.center.length()).to.be.greaterThan(RANGE);
            expect(faceIndices(faces, [caster])[0]).to.eql([0]);
            for (let face = 1; face < 6; face++) {
                expect(faces[face].size, `face ${face}`).to.equal(0);
            }
        });

        it('excludes an elongated caster from the faces only its bounding sphere reaches', function () {
            const light = createLight(new Vec3(0, 0, 0));

            // a long thin beam beside the light. Its bounding sphere has a radius of ~60, so a
            // sphere based test reaches faces the box itself is nowhere near.
            const caster = createCaster(new Vec3(70, 0, 0), new Vec3(120, 1, 1));

            const faces = cullFaces(light, [caster]);
            expect(faceIndices(faces, [caster])).to.eql([[0], [], [], [], [], []]);

            // the same caster's bounding sphere is not rejected by those other faces
            const sphere = new BoundingSphere(caster.aabb.center.clone(), caster._aabb.halfExtents.length());
            let sphereFaces = 0;
            for (let face = 0; face < 6; face++) {
                if (light.getRenderData(null, face).shadowCamera.frustum.containsSphere(sphere) > 0) {
                    sphereFaces++;
                }
            }
            expect(sphereFaces).to.be.greaterThan(1);
        });

        it('places a caster straddling two faces in both of them', function () {
            const light = createLight(new Vec3(0, 0, 0));

            // on the diagonal shared by the +X and +Y faces
            const caster = createCaster(new Vec3(30, 30, 0), 1);

            const faces = cullFaces(light, [caster]);
            expect(faces[0].has(caster), '+X').to.equal(true);
            expect(faces[2].has(caster), '+Y').to.equal(true);
            expect(faces[1].size + faces[3].size + faces[4].size + faces[5].size).to.equal(0);
        });

        it('excludes a caster which does not cast shadows', function () {
            const light = createLight(new Vec3(0, 0, 0));
            const caster = createCaster(new Vec3(50, 0, 0), 1);
            caster.castShadow = false;

            const faces = cullFaces(light, [caster]);
            faces.forEach(face => expect(face.size).to.equal(0));
        });

        it('includes a caster with culling disabled in all faces, wherever it is', function () {
            const light = createLight(new Vec3(0, 0, 0));
            const caster = createCaster(new Vec3(RANGE * 10, 0, 0), 1);
            caster.cull = false;

            const faces = cullFaces(light, [caster]);
            faces.forEach(face => expect(face.has(caster)).to.equal(true));
        });

        it('honours a custom visibility function', function () {
            const light = createLight(new Vec3(0, 0, 0));
            const hidden = createCaster(new Vec3(50, 0, 0), 1);
            const shown = createCaster(new Vec3(-50, 0, 0), 1);
            /** @type {Camera[]} */
            const camerasSeen = [];
            hidden.isVisibleFunc = () => false;
            shown.isVisibleFunc = (camera) => {
                camerasSeen.push(camera);
                return true;
            };

            const faces = cullFaces(light, [hidden, shown]);
            faces.forEach((face) => {
                expect(face.has(hidden)).to.equal(false);
                expect(face.has(shown)).to.equal(true);
            });

            // evaluated once per face, with that face's shadow camera
            expect(camerasSeen).to.have.lengthOf(6);
            for (let face = 0; face < 6; face++) {
                expect(camerasSeen[face]).to.equal(light.getRenderData(null, face).shadowCamera);
            }
        });

        it('marks visible casters as visible this frame', function () {
            const light = createLight(new Vec3(0, 0, 0));
            const visible = createCaster(new Vec3(50, 0, 0), 1);
            const hidden = createCaster(new Vec3(RANGE * 3, 0, 0), 1);

            cullFaces(light, [visible, hidden]);
            expect(visible.visibleThisFrame).to.equal(true);
            expect(hidden.visibleThisFrame).to.equal(false);
        });

        it('matches a per-face frustum test over a spread of casters', function () {
            const light = createLight(new Vec3(5, -7, 11));

            // deterministic pseudo random casters, spread over roughly three times the light range
            let seed = 1234567;
            const random = () => {
                seed = (seed * 1103515245 + 12345) & 0x7fffffff;
                return seed / 0x7fffffff;
            };
            const casters = [];
            for (let i = 0; i < 300; i++) {
                const position = new Vec3(
                    (random() * 2 - 1) * RANGE * 1.5,
                    (random() * 2 - 1) * RANGE * 1.5,
                    (random() * 2 - 1) * RANGE * 1.5
                );
                casters.push(createCaster(position, 1 + random() * 30));
            }

            const faces = cullFaces(light, casters);
            const reference = referenceFaces(light, casters);

            let visible = 0;
            let dropped = 0;
            for (let face = 0; face < 6; face++) {
                visible += reference[face].size;

                for (const caster of faces[face]) {
                    // never report a caster the face's frustum rejects
                    expect(reference[face].has(caster), `face ${face} extra caster`).to.equal(true);
                }

                for (const caster of reference[face]) {
                    if (faces[face].has(caster)) {
                        continue;
                    }

                    // the classification is tighter than a per-plane frustum test near the frustum
                    // corners, so it may drop casters the reference keeps - but only ones which
                    // provably cannot render into any face
                    expect(outsideAllFaces(light, caster), `face ${face} dropped caster`).to.equal(true);
                    dropped++;
                }
            }

            // the spread should exercise both a decent number of visible casters and the corner
            // cases the two tests disagree on
            expect(visible).to.be.greaterThan(100);
            expect(dropped).to.be.greaterThan(0);
        });
    });

    describe('#cull - spot', function () {

        it('culls the single face against the spot frustum', function () {
            const light = createLight(new Vec3(0, 0, 0), 'spot');
            const inside = createCaster(new Vec3(0, -50, 0), 1);
            const outside = createCaster(new Vec3(0, RANGE * 3, 0), 1);

            const casters = [inside, outside];
            const faces = cullFaces(light, casters);
            expect(faces).to.have.lengthOf(1);
            expect(faceIndices(faces, casters)[0]).to.eql([0]);
        });
    });
});
