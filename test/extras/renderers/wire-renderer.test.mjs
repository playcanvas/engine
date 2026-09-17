import { expect } from 'chai';

import { Color } from '../../../src/core/math/color.js';
import { Mat4 } from '../../../src/core/math/mat4.js';
import { Vec3 } from '../../../src/core/math/vec3.js';
import { BoundingBox } from '../../../src/core/shape/bounding-box.js';
import { OrientedBox } from '../../../src/core/shape/oriented-box.js';
import { WireRenderer } from '../../../src/extras/renderers/wire-renderer.js';
import { Entity } from '../../../src/framework/entity.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

// runs the function with console.error suppressed, and returns the number of debug asserts it fired
const withAssertCount = (fn) => {
    const error = console.error;
    let count = 0;
    console.error = () => {
        count++;
    };
    try {
        fn();
    } finally {
        console.error = error;
    }
    return count;
};

describe('WireRenderer', function () {

    let app;
    let wire;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        wire = new WireRenderer(app);
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    const batchFor = (depthTest = true) => app.scene.immediate.getBatch(app.scene.defaultDrawLayer, depthTest);

    /**
     * @param {Function} fn - The drawing function to measure.
     * @param {boolean} [depthTest] - The depth test mode of the batch to read.
     * @returns {number} Vertices the function added to the batch.
     */
    const written = (fn, depthTest = true) => {
        const batch = batchFor(depthTest);
        const before = batch._vertexCount;
        fn();
        return batch._vertexCount - before;
    };

    /**
     * @param {Function} fn - The drawing function to measure.
     * @returns {object} The segments added, and whether the allocation was filled exactly.
     */
    const draw = (fn) => {
        const verts = written(fn);
        return { segments: verts / 2, filled: app.scene.immediate.lineWriter.filled };
    };

    /**
     * @param {Function} fn - The drawing function to measure.
     * @returns {number} The number of allocateLines calls the function made.
     */
    const allocations = (fn) => {
        const immediate = app.scene.immediate;
        const original = immediate.allocateLines;
        let count = 0;
        immediate.allocateLines = function (...args) {
            count++;
            return original.apply(this, args);
        };
        try {
            fn();
        } finally {
            immediate.allocateLines = original;
        }
        return count;
    };

    const positionsOf = (count, depthTest = true) => {
        const batch = batchFor(depthTest);
        return Array.from(batch._positions.subarray(0, count * 3));
    };

    const colorsOf = (count, depthTest = true) => {
        const batch = batchFor(depthTest);
        return Array.from(batch._colors.subarray(0, count * 4));
    };

    describe('allocation', function () {

        // an under-fill would silently leave zeroed vertices in the batch, so every shape is
        // checked for both its segment count and that it filled its allocation exactly
        const cases = [
            ['line', () => wire.line(new Vec3(0, 0, 0), new Vec3(1, 0, 0)), 1],
            ['polyline', () => wire.polyline([new Vec3(), new Vec3(1, 0, 0), new Vec3(1, 1, 0)]), 2],
            ['loop', () => wire.loop([new Vec3(), new Vec3(1, 0, 0), new Vec3(1, 1, 0)]), 3],
            ['boxMinMax', () => wire.boxMinMax(new Vec3(-1, -1, -1), new Vec3(1, 1, 1)), 12],
            ['sphere', () => wire.sphere(new Vec3(), 1), 60],
            ['circle', () => wire.circle(new Vec3(), Vec3.UP, 1), 20],
            ['cylinder', () => wire.cylinder(new Vec3(), new Vec3(0, 2, 0), 1), 44],
            ['capsule', () => wire.capsule(new Vec3(), new Vec3(0, 2, 0), 0.5), 84],
            ['cone', () => wire.cone(new Vec3(), new Vec3(0, -1, 0), 30, 2), 24],
            ['plane', () => wire.plane(new Vec3(), Vec3.UP, 2), 5],
            ['point', () => wire.point(new Vec3(), 1), 3],
            ['arrow', () => wire.arrow(new Vec3(), new Vec3(0, 3, 0)), 25],
            ['axes', () => wire.axes(Mat4.IDENTITY, 1), 3],
            ['frustum', () => wire.frustum(new Mat4().setPerspective(45, 1, 1, 10)), 12]
        ];

        cases.forEach(([name, fn, segments]) => {
            it(`${name} writes ${segments} segments and fills its allocation exactly`, function () {
                expect(draw(fn)).to.deep.equal({ segments, filled: true });
            });
        });

        it('scales the tessellated shapes with segments', function () {
            wire.segments = 8;
            expect(draw(() => wire.sphere(new Vec3(), 1))).to.deep.equal({ segments: 24, filled: true });
            expect(draw(() => wire.circle(new Vec3(), Vec3.UP, 1))).to.deep.equal({ segments: 8, filled: true });
        });

        it('clamps segments to a usable minimum', function () {
            wire.segments = 1;
            expect(draw(() => wire.circle(new Vec3(), Vec3.UP, 1))).to.deep.equal({ segments: 3, filled: true });
        });

        it('leaves the shapes with a fixed segment count unaffected by segments', function () {
            wire.segments = 40;
            expect(draw(() => wire.boxMinMax(new Vec3(), new Vec3(1, 1, 1)))).to.deep.equal({ segments: 12, filled: true });
            expect(draw(() => wire.point(new Vec3(), 1))).to.deep.equal({ segments: 3, filled: true });
        });
    });

    describe('degenerate input', function () {

        it('draws nothing for a zero length cylinder', function () {
            expect(written(() => wire.cylinder(new Vec3(), new Vec3(), 1))).to.equal(0);
        });

        it('draws nothing for a zero length arrow', function () {
            expect(written(() => wire.arrow(new Vec3(), new Vec3()))).to.equal(0);
        });

        it('draws nothing for a zero direction cone', function () {
            expect(written(() => wire.cone(new Vec3(), new Vec3(), 30, 1))).to.equal(0);
        });

        it('falls back to a sphere for a zero length capsule', function () {
            expect(draw(() => wire.capsule(new Vec3(), new Vec3(), 1))).to.deep.equal({ segments: 60, filled: true });
        });

        it('draws nothing for a polyline with fewer than two points', function () {
            expect(written(() => wire.polyline([new Vec3()]))).to.equal(0);
            expect(written(() => wire.loop([new Vec3()]))).to.equal(0);
        });
    });

    describe('geometry', function () {

        it('places every sphere vertex on the sphere', function () {
            wire.sphere(new Vec3(2, 3, 4), 5);

            const points = positionsOf(120);
            let maxError = 0;
            for (let i = 0; i < 120; i++) {
                const dx = points[i * 3] - 2;
                const dy = points[i * 3 + 1] - 3;
                const dz = points[i * 3 + 2] - 4;
                maxError = Math.max(maxError, Math.abs(Math.hypot(dx, dy, dz) - 5));
            }
            expect(maxError).to.be.below(1e-5);
        });

        it('draws a box between its corners', function () {
            wire.boxMinMax(new Vec3(-1, -2, -3), new Vec3(1, 2, 3));

            const points = positionsOf(24);
            for (let i = 0; i < 24; i++) {
                expect(Math.abs(points[i * 3])).to.equal(1);
                expect(Math.abs(points[i * 3 + 1])).to.equal(2);
                expect(Math.abs(points[i * 3 + 2])).to.equal(3);
            }
        });

        it('unprojects a frustum to its view space corners', function () {
            // 90 degree vertical fov, aspect 1, near 1, far 10
            wire.frustum(new Mat4().setPerspective(90, 1, 1, 10));

            const points = positionsOf(24);
            const corners = new Set();
            for (let i = 0; i < 24; i++) {
                corners.add(points.slice(i * 3, i * 3 + 3).map(v => +v.toFixed(3)).join(','));
            }

            expect(corners.size).to.equal(8);
            expect(corners.has('-1,-1,-1')).to.equal(true);
            expect(corners.has('1,1,-1')).to.equal(true);
            expect(corners.has('-10,-10,-10')).to.equal(true);
            expect(corners.has('10,10,-10')).to.equal(true);
        });

        it('draws a camera frustum the same whether or not its parent is scaled', function () {
            const makeCamera = (parentScale) => {
                const parent = new Entity();
                parent.setLocalScale(parentScale, parentScale, parentScale);
                const camera = new Entity();
                camera.addComponent('camera', { fov: 45, nearClip: 1, farClip: 10 });
                camera.camera.aspectRatio = 1;
                parent.addChild(camera);
                app.root.addChild(parent);
                return camera;
            };

            const corners = (camera) => {
                batchFor(true).clear();
                wire.frustum(camera.camera);
                const out = positionsOf(24).map(v => +v.toFixed(4));
                batchFor(true).clear();
                return out;
            };

            // the renderer builds a scale-free view transform, so the drawn volume must not grow
            // with the parent's scale
            expect(corners(makeCamera(1))).to.deep.equal(corners(makeCamera(4)));
        });

        it('honors a camera calculateTransform override', function () {
            const camera = new Entity();
            camera.addComponent('camera', { fov: 45, nearClip: 1, farClip: 10 });
            camera.camera.aspectRatio = 1;
            app.root.addChild(camera);

            batchFor(true).clear();
            wire.frustum(camera.camera);
            const before = positionsOf(24).map(v => +v.toFixed(4));
            batchFor(true).clear();

            // the renderer uses this in place of the node transform, so the frustum must move
            camera.camera.calculateTransform = (mat) => {
                mat.setTranslate(100, 0, 0);
            };
            wire.frustum(camera.camera);
            const after = positionsOf(24).map(v => +v.toFixed(4));
            batchFor(true).clear();

            expect(after).to.not.deep.equal(before);
            for (let i = 0; i < 24; i++) {
                expect(after[i * 3] - before[i * 3]).to.be.closeTo(100, 1e-3);
            }
        });

        it('marks a point with three axis aligned arms', function () {
            wire.point(new Vec3(1, 1, 1), 2);
            expect(positionsOf(6)).to.deep.equal([
                0, 1, 1, 2, 1, 1,
                1, 0, 1, 1, 2, 1,
                1, 1, 0, 1, 1, 2
            ]);
        });
    });

    describe('#color', function () {

        it('applies the renderer color to every vertex of a shape', function () {
            wire.color = new Color(0.25, 0.5, 0.75, 1);
            wire.line(new Vec3(), new Vec3(1, 0, 0));

            expect(colorsOf(2).map(v => +v.toFixed(3))).to.deep.equal([
                0.25, 0.5, 0.75, 1,
                0.25, 0.5, 0.75, 1
            ]);
        });

        it('uses per-point colors when given them', function () {
            wire.lines([new Vec3(), new Vec3(1, 0, 0)], [Color.RED, Color.BLUE]);
            expect(colorsOf(2)).to.deep.equal([
                1, 0, 0, 1,
                0, 0, 1, 1
            ]);
        });

        it('colors the axes red, green and blue regardless of the renderer color', function () {
            wire.color = Color.YELLOW;
            wire.axes(Mat4.IDENTITY, 1);

            expect(colorsOf(6)).to.deep.equal([
                1, 0, 0, 1, 1, 0, 0, 1,
                0, 1, 0, 1, 0, 1, 0, 1,
                0, 0, 1, 1, 0, 0, 1, 1
            ]);
        });

        it('asserts when the color count does not match the positions', function () {
            wire.transform = new Mat4();

            const count = withAssertCount(() => {
                // reading past the end of a short color array throws, as it does for the batch
                // itself, but the assert fires first and names the actual problem
                expect(() => wire.lines([new Vec3(), new Vec3()], [Color.RED])).to.throw(TypeError);
            });
            expect(count).to.be.at.least(1);
        });
    });

    describe('#transform', function () {

        it('applies to generated shapes', function () {
            wire.transform = new Mat4().setTranslate(10, 0, 0);
            wire.point(new Vec3(), 2);

            expect(positionsOf(6)).to.deep.equal([
                9, 0, 0, 11, 0, 0,
                10, -1, 0, 10, 1, 0,
                10, 0, -1, 10, 0, 1
            ]);
        });

        it('applies inside the arc path', function () {
            wire.transform = new Mat4().setTranslate(100, 0, 0);
            wire.circle(new Vec3(), Vec3.UP, 1);

            const points = positionsOf(40);
            for (let i = 0; i < 40; i++) {
                const dx = points[i * 3] - 100;
                const dy = points[i * 3 + 1];
                const dz = points[i * 3 + 2];
                expect(Math.abs(Math.hypot(dx, dy, dz) - 1)).to.be.below(1e-5);
            }
        });

        it('applies to supplied points', function () {
            wire.transform = new Mat4().setTranslate(0, 5, 0);
            wire.lines([new Vec3(1, 0, 0), new Vec3(2, 0, 0)]);
            expect(positionsOf(2)).to.deep.equal([1, 5, 0, 2, 5, 0]);
        });
    });

    describe('#box', function () {

        it('accepts a BoundingBox', function () {
            const box = new BoundingBox(new Vec3(1, 1, 1), new Vec3(1, 1, 1));
            expect(draw(() => wire.box(box))).to.deep.equal({ segments: 12, filled: true });
            expect(positionsOf(1)).to.deep.equal([0, 0, 0]);
        });

        it('draws an OrientedBox in its own space', function () {
            const box = new OrientedBox(new Mat4().setTranslate(50, 0, 0));
            box.halfExtents.set(1, 1, 1);

            expect(draw(() => wire.box(box))).to.deep.equal({ segments: 12, filled: true });
            expect(positionsOf(1)).to.deep.equal([49, -1, -1]);
        });

        it('leaves the renderer transform untouched by an OrientedBox', function () {
            const outer = new Mat4().setTranslate(0, 7, 0);
            wire.transform = outer;

            const box = new OrientedBox(new Mat4().setTranslate(50, 0, 0));
            box.halfExtents.set(1, 1, 1);
            wire.box(box);

            expect(wire.transform).to.equal(outer);
        });
    });

    describe('the line family', function () {

        it('passes user data straight through when no transform is set', function () {
            expect(allocations(() => wire.lines([new Vec3(), new Vec3(1, 0, 0)]))).to.equal(0);
            expect(allocations(() => wire.linesPacked([0, 0, 0, 1, 0, 0]))).to.equal(0);
        });

        it('copies through an allocation when a transform is set', function () {
            wire.transform = new Mat4().setTranslate(1, 0, 0);
            expect(allocations(() => wire.lines([new Vec3(), new Vec3(1, 0, 0)]))).to.equal(1);
            expect(allocations(() => wire.linesPacked([0, 0, 0, 1, 0, 0]))).to.equal(1);
        });

        it('still reaches the batch on the passthrough path', function () {
            expect(written(() => wire.lines([new Vec3(), new Vec3(1, 0, 0)]))).to.equal(2);
            expect(written(() => wire.linesPacked([0, 0, 0, 1, 0, 0]))).to.equal(2);
        });

        it('closes a loop but not a polyline', function () {
            const points = [new Vec3(), new Vec3(1, 0, 0), new Vec3(1, 1, 0), new Vec3(0, 1, 0)];
            expect(draw(() => wire.polyline(points)).segments).to.equal(3);
            expect(draw(() => wire.loop(points)).segments).to.equal(4);
        });

        it('asserts on an odd number of positions', function () {
            const count = withAssertCount(() => {
                wire.lines([new Vec3(), new Vec3(), new Vec3()]);
            });
            expect(count).to.be.at.least(1);
        });

        it('asserts when packed positions do not form whole segments', function () {
            // not a multiple of three leaves a partial position
            expect(withAssertCount(() => wire.linesPacked([0, 0, 0, 1, 1]))).to.be.at.least(1);

            // a multiple of three but not of six leaves an unpaired vertex
            expect(withAssertCount(() => wire.linesPacked([0, 0, 0, 1, 1, 1, 2, 2, 2]))).to.be.at.least(1);
        });
    });

    describe('#depthTest and #layer', function () {

        it('submits into the batch matching its depth test mode', function () {
            wire.depthTest = false;
            expect(written(() => wire.line(new Vec3(), new Vec3(1, 0, 0)), false)).to.equal(2);
            expect(batchFor(true)._vertexCount).to.equal(0);
        });

        it('submits into an explicitly chosen layer', function () {
            const layer = app.scene.layers.getLayerByName('World');
            wire.layer = layer;
            wire.line(new Vec3(), new Vec3(1, 0, 0));

            expect(app.scene.immediate.getBatch(layer, true)._vertexCount).to.equal(2);
            expect(batchFor(true)._vertexCount).to.equal(0);
        });
    });

    describe('#light', function () {

        const addLight = (type) => {
            const entity = new Entity();
            entity.addComponent('light', { type: type, color: new Color(0.1, 0.2, 0.3), range: 5 });
            app.root.addChild(entity);
            return entity;
        };

        it('draws an omni light as a sphere of its range', function () {
            const entity = addLight('omni');
            expect(draw(() => wire.light(entity.light))).to.deep.equal({ segments: 60, filled: true });
        });

        it('draws a spot light as a cone', function () {
            const entity = addLight('spot');
            expect(draw(() => wire.light(entity.light))).to.deep.equal({ segments: 24, filled: true });
        });

        it('draws a directional light as an arrow', function () {
            const entity = addLight('directional');
            expect(draw(() => wire.light(entity.light, 10))).to.deep.equal({ segments: 25, filled: true });
        });

        it('uses the light color and restores the renderer color', function () {
            const entity = addLight('omni');
            wire.color = Color.YELLOW;
            wire.light(entity.light);

            expect(colorsOf(1).map(v => +v.toFixed(3))).to.deep.equal([0.1, 0.2, 0.3, 1]);
            expect(wire.color).to.equal(Color.YELLOW);
        });

        it('aims along the negative y-axis of the entity, not its forward axis', function () {
            const entity = addLight('directional');
            entity.setLocalEulerAngles(0, 0, 0);
            wire.light(entity.light, 10);

            // the arrow shaft is the first segment, running from the entity to entity - up * size
            expect(positionsOf(2).map(v => +v.toFixed(4))).to.deep.equal([0, 0, 0, 0, -10, 0]);
        });
    });
});
