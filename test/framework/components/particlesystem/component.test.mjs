import { expect } from 'chai';

import { CURVE_SPLINE } from '../../../../src/core/math/constants.js';
import { CurveSet } from '../../../../src/core/math/curve-set.js';
import { Curve } from '../../../../src/core/math/curve.js';
import { Vec3 } from '../../../../src/core/math/vec3.js';
import { AssetListLoader } from '../../../../src/framework/asset/asset-list-loader.js';
import { Asset } from '../../../../src/framework/asset/asset.js';
import { Entity } from '../../../../src/framework/entity.js';
import { BLEND_NORMAL, EMITTERSHAPE_BOX, LAYERID_WORLD, PARTICLEORIENTATION_SCREEN } from '../../../../src/scene/constants.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('ParticleSystemComponent', function () {
    let app;
    let assets = {};

    const loadAssets = function (cb) {
        const assetList = [
            new Asset('Box', 'model', {
                url: '/test/assets/cube/cube.json'
            }),
            new Asset('ColorMap', 'texture', {
                url: '/test/assets/test.png'
            }, {
                srgb: true
            }),
            new Asset('NormalMap', 'texture', {
                url: '/test/assets/test.png'
            })
        ];
        const loader = new AssetListLoader(assetList, app.assets);
        loader.ready(function () {
            assets.mesh = assetList[0];
            assets.colorMap = assetList[1];
            assets.normalMap = assetList[2];
            cb();
        });
        loader.load();
    };

    beforeEach(function (done) {
        jsdomSetup();
        app = createApp();

        loadAssets(done);
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
        assets = {};
    });

    it('Add particlesystem', function () {
        const e = new Entity();

        e.addComponent('particlesystem');

        expect(e.particlesystem).to.exist;
    });

    it('Remove particlesystem', function () {
        const e = new Entity();

        e.addComponent('particlesystem');
        e.removeComponent('particlesystem');

        expect(e.particlesystem).to.not.exist;
    });

    it('Add particlesystem with default values', function () {
        const e = new Entity();

        e.addComponent('particlesystem');

        const c = e.particlesystem;
        expect(c.enabled).to.be.true;
        expect(c.autoPlay).to.be.true;
        expect(c.numParticles).to.equal(1);
        expect(c.lifetime).to.equal(50);
        expect(c.rate).to.equal(1);
        expect(c.rate2).to.be.null;
        expect(c.startAngle).to.equal(0);
        expect(c.startAngle2).to.be.null;
        expect(c.loop).to.be.true;
        expect(c.preWarm).to.be.false;
        expect(c.lighting).to.be.false;
        expect(c.halfLambert).to.be.false;
        expect(c.intensity).to.equal(1);
        expect(c.depthWrite).to.be.false;
        expect(c.noFog).to.be.false;
        expect(c.depthSoftening).to.equal(0);
        expect(c.sort).to.equal(0);
        expect(c.blendType).to.equal(BLEND_NORMAL);
        expect(c.stretch).to.equal(0);
        expect(c.alignToMotion).to.be.false;
        expect(c.emitterShape).to.equal(EMITTERSHAPE_BOX);
        expect(c.emitterExtents).to.be.an.instanceof(Vec3);
        expect(c.emitterExtents.equals(new Vec3())).to.be.true;
        expect(c.emitterExtentsInner.equals(new Vec3())).to.be.true;
        expect(c.emitterRadius).to.equal(0);
        expect(c.emitterRadiusInner).to.equal(0);
        expect(c.initialVelocity).to.equal(0);
        expect(c.wrap).to.be.false;
        expect(c.wrapBounds).to.be.an.instanceof(Vec3);
        expect(c.wrapBounds.equals(new Vec3())).to.be.true;
        expect(c.localSpace).to.be.false;
        expect(c.screenSpace).to.be.false;
        expect(c.colorMapAsset).to.be.null;
        expect(c.normalMapAsset).to.be.null;
        expect(c.colorMap).to.be.null;
        expect(c.normalMap).to.be.null;
        expect(c.mesh).to.be.null;
        expect(c.meshAsset).to.be.null;
        expect(c.renderAsset).to.be.null;
        expect(c.orientation).to.equal(PARTICLEORIENTATION_SCREEN);
        expect(c.particleNormal.equals(new Vec3(0, 1, 0))).to.be.true;
        expect(c.localVelocityGraph).to.be.null;
        expect(c.localVelocityGraph2).to.be.null;
        expect(c.velocityGraph).to.be.null;
        expect(c.velocityGraph2).to.be.null;
        expect(c.rotationSpeedGraph).to.be.null;
        expect(c.rotationSpeedGraph2).to.be.null;
        expect(c.radialSpeedGraph).to.be.null;
        expect(c.radialSpeedGraph2).to.be.null;
        expect(c.scaleGraph).to.be.null;
        expect(c.scaleGraph2).to.be.null;
        expect(c.colorGraph).to.be.null;
        expect(c.colorGraph2).to.be.null;
        expect(c.alphaGraph).to.be.null;
        expect(c.alphaGraph2).to.be.null;
        expect(c.animTilesX).to.equal(1);
        expect(c.animTilesY).to.equal(1);
        expect(c.animStartFrame).to.equal(0);
        expect(c.animNumFrames).to.equal(1);
        expect(c.animNumAnimations).to.equal(1);
        expect(c.animIndex).to.equal(0);
        expect(c.randomizeAnimIndex).to.be.false;
        expect(c.animSpeed).to.equal(1);
        expect(c.animLoop).to.be.true;
        expect(c.layers).to.deep.equal([LAYERID_WORLD]);
        expect(c.drawOrder).to.equal(0);
    });

    it('Add particlesystem with enabled false', function () {
        const e = new Entity();

        e.addComponent('particlesystem', {
            enabled: false
        });

        expect(e.particlesystem.enabled).to.be.false;
    });

    it('Initializes vec3 and curve properties from JSON-style data', function () {
        const e = new Entity();

        e.addComponent('particlesystem', {
            emitterExtents: [1, 2, 3],
            wrapBounds: [4, 5, 6],
            alphaGraph: { type: CURVE_SPLINE, keys: [0, 0, 1, 1] },
            colorGraph: { type: CURVE_SPLINE, keys: [[0, 0, 1, 1], [0, 0, 1, 1], [0, 0, 1, 1]] }
        });

        const c = e.particlesystem;
        expect(c.emitterExtents).to.be.an.instanceof(Vec3);
        expect(c.emitterExtents.equals(new Vec3(1, 2, 3))).to.be.true;
        expect(c.wrapBounds.equals(new Vec3(4, 5, 6))).to.be.true;
        expect(c.alphaGraph).to.be.an.instanceof(Curve);
        expect(c.alphaGraph.type).to.equal(CURVE_SPLINE);
        expect(c.colorGraph).to.be.an.instanceof(CurveSet);
        expect(c.colorGraph.type).to.equal(CURVE_SPLINE);
    });

    it('Preserves defaults for properties initialized with undefined', function () {
        const e = new Entity();

        e.addComponent('particlesystem', {
            numParticles: undefined,
            emitterExtents: undefined,
            alphaGraph: undefined
        });

        const c = e.particlesystem;
        expect(c.numParticles).to.equal(1);
        expect(c.emitterExtents.equals(new Vec3())).to.be.true;
        expect(c.alphaGraph).to.be.null;
    });

    it('Accepts explicit null for curve properties', function () {
        const e = new Entity();

        e.addComponent('particlesystem', {
            alphaGraph: null,
            colorGraph: null
        });

        expect(e.particlesystem.alphaGraph).to.be.null;
        expect(e.particlesystem.colorGraph).to.be.null;
    });

    it('Initializes from Vec3 and Curve instances', function () {
        const extents = new Vec3(1, 2, 3);
        const alphaGraph = new Curve([0, 0, 1, 1]);
        const e = new Entity();

        e.addComponent('particlesystem', {
            emitterExtents: extents,
            alphaGraph: alphaGraph
        });

        expect(e.particlesystem.emitterExtents).to.equal(extents);
        expect(e.particlesystem.alphaGraph).to.equal(alphaGraph);
    });

    it('Remaps legacy mesh asset id to meshAsset', function () {
        const e = new Entity();
        app.root.addChild(e);
        e.addComponent('particlesystem', {
            mesh: assets.mesh.id
        });

        expect(e.particlesystem.meshAsset).to.equal(assets.mesh.id);
    });

    it('Stores the asset id when assigned an Asset instance', function () {
        const e = new Entity();
        app.root.addChild(e);
        e.addComponent('particlesystem');

        e.particlesystem.colorMapAsset = assets.colorMap;

        expect(e.particlesystem.colorMapAsset).to.equal(assets.colorMap.id);
    });

    it('Does not trigger asset loads when initialized disabled', function () {
        const asset = new Asset('Unloaded', 'texture', {
            url: '/test/assets/test.png'
        });
        app.assets.add(asset);

        const e = new Entity();
        app.root.addChild(e);
        e.addComponent('particlesystem', {
            enabled: false,
            colorMapAsset: asset.id
        });

        expect(e.particlesystem.enabled).to.be.false;
        expect(asset.loading).to.be.false;
        expect(asset.loaded).to.be.false;

        // the same data on an enabled component does trigger the load
        const e2 = new Entity();
        app.root.addChild(e2);
        e2.addComponent('particlesystem', {
            colorMapAsset: asset.id
        });

        expect(asset.loading || asset.loaded).to.be.true;
    });

    it('Clones a particlesystem component', function () {
        const e = new Entity();
        e.addComponent('particlesystem', {
            numParticles: 10,
            loop: false,
            emitterExtents: [1, 2, 3],
            alphaGraph: { type: CURVE_SPLINE, keys: [0, 0, 1, 1] },
            colorGraph: { type: CURVE_SPLINE, keys: [[0, 0, 1, 1], [0, 0, 1, 1], [0, 0, 1, 1]] }
        });
        app.root.addChild(e);

        const clone = e.clone();
        const c = clone.particlesystem;
        const src = e.particlesystem;

        expect(c.numParticles).to.equal(10);
        expect(c.loop).to.be.false;
        expect(c.emitterExtents.equals(new Vec3(1, 2, 3))).to.be.true;
        expect(c.emitterExtents).to.not.equal(src.emitterExtents);
        expect(c.alphaGraph).to.be.an.instanceof(Curve);
        expect(c.alphaGraph).to.not.equal(src.alphaGraph);
        expect(c.alphaGraph.type).to.equal(CURVE_SPLINE);
        expect(c.colorGraph).to.be.an.instanceof(CurveSet);
        expect(c.colorGraph).to.not.equal(src.colorGraph);
        expect(c.layers).to.deep.equal(src.layers);
        expect(c.layers).to.not.equal(src.layers);
    });

    it('pause() prevents the particle system from playing', function () {
        const e = new Entity();
        e.addComponent('particlesystem');
        app.root.addChild(e);

        e.particlesystem.pause();

        expect(e.particlesystem.isPlaying()).to.be.false;
    });

    it('isPlaying() returns false when no emitter exists', function () {
        const e = new Entity();
        e.addComponent('particlesystem');
        app.root.addChild(e);

        // NullGraphicsDevice disables particle systems, so no emitter is created
        expect(e.particlesystem.isPlaying()).to.be.false;
    });

    it('isPlaying() tracks the emitter simulation clock for a non-looping system', function () {
        const e = new Entity();
        e.addComponent('particlesystem');
        app.root.addChild(e);
        const c = e.particlesystem;

        // NullGraphicsDevice creates no emitter, so stub one to exercise the time logic
        c.emitter = { loop: false, simTimeTotal: 0, endTime: 5 };

        expect(c.isPlaying()).to.be.true;       // within the window

        c.emitter.simTimeTotal = 5;
        expect(c.isPlaying()).to.be.true;       // boundary is still playing

        c.emitter.simTimeTotal = 5.001;
        expect(c.isPlaying()).to.be.false;      // simulation has passed endTime

        c.emitter = null;                       // drop the stub before teardown
    });

    it('isPlaying() is true for a looping emitter regardless of elapsed time', function () {
        const e = new Entity();
        e.addComponent('particlesystem');
        app.root.addChild(e);
        const c = e.particlesystem;

        c.emitter = { loop: true, simTimeTotal: 1e6, endTime: 0 };

        expect(c.isPlaying()).to.be.true;

        c.emitter = null;                       // drop the stub before teardown
    });

    it('isPlaying() is false while paused even within the end time', function () {
        const e = new Entity();
        e.addComponent('particlesystem');
        app.root.addChild(e);
        const c = e.particlesystem;

        c.emitter = { loop: false, simTimeTotal: 0, endTime: 5 };
        c.pause();

        expect(c.isPlaying()).to.be.false;

        c.emitter = null;                       // drop the stub before teardown
    });

    it('ColorMap Asset unbinds on destroy', function () {
        const e = new Entity();
        app.root.addChild(e);
        e.addComponent('particlesystem', {
            colorMapAsset: assets.colorMap.id
        });

        expect(assets.colorMap.hasEvent('load')).to.be.true;
        expect(assets.colorMap.hasEvent('unload')).to.be.true;
        expect(assets.colorMap.hasEvent('change')).to.be.true;
        expect(assets.colorMap.hasEvent('remove')).to.be.true;

        e.destroy();

        expect(assets.colorMap.hasEvent('load')).to.be.false;
        expect(assets.colorMap.hasEvent('unload')).to.be.false;
        expect(assets.colorMap.hasEvent('change')).to.be.false;
        expect(assets.colorMap.hasEvent('remove')).to.be.false;
    });

    it('ColorMap Asset unbinds on reset', function () {
        const e = new Entity();
        app.root.addChild(e);
        e.addComponent('particlesystem', {
            colorMapAsset: assets.colorMap.id
        });

        expect(assets.colorMap.hasEvent('load')).to.be.true;
        expect(assets.colorMap.hasEvent('unload')).to.be.true;
        expect(assets.colorMap.hasEvent('change')).to.be.true;
        expect(assets.colorMap.hasEvent('remove')).to.be.true;

        e.particlesystem.colorMapAsset = null;

        expect(assets.colorMap.hasEvent('load')).to.be.false;
        expect(assets.colorMap.hasEvent('unload')).to.be.false;
        expect(assets.colorMap.hasEvent('change')).to.be.false;
        expect(assets.colorMap.hasEvent('remove')).to.be.false;
    });

    it('NormalMap Asset unbinds on destroy', function () {
        const e = new Entity();
        app.root.addChild(e);
        e.addComponent('particlesystem', {
            normalMapAsset: assets.normalMap.id
        });

        expect(assets.normalMap.hasEvent('load')).to.be.true;
        expect(assets.normalMap.hasEvent('unload')).to.be.true;
        expect(assets.normalMap.hasEvent('change')).to.be.true;
        expect(assets.normalMap.hasEvent('remove')).to.be.true;

        e.destroy();

        expect(assets.normalMap.hasEvent('load')).to.be.false;
        expect(assets.normalMap.hasEvent('unload')).to.be.false;
        expect(assets.normalMap.hasEvent('change')).to.be.false;
        expect(assets.normalMap.hasEvent('remove')).to.be.false;
    });

    it('NormalMap Asset unbinds on reset', function () {
        const e = new Entity();
        app.root.addChild(e);
        e.addComponent('particlesystem', {
            normalMapAsset: assets.normalMap.id
        });

        expect(assets.normalMap.hasEvent('load')).to.be.true;
        expect(assets.normalMap.hasEvent('unload')).to.be.true;
        expect(assets.normalMap.hasEvent('change')).to.be.true;
        expect(assets.normalMap.hasEvent('remove')).to.be.true;

        e.particlesystem.normalMapAsset = null;

        expect(assets.normalMap.hasEvent('load')).to.be.false;
        expect(assets.normalMap.hasEvent('unload')).to.be.false;
        expect(assets.normalMap.hasEvent('change')).to.be.false;
        expect(assets.normalMap.hasEvent('remove')).to.be.false;
    });

    it('Mesh Asset unbinds on destroy', function () {
        const e = new Entity();
        app.root.addChild(e);
        e.addComponent('particlesystem', {
            meshAsset: assets.mesh.id
        });

        expect(assets.mesh.hasEvent('load')).to.be.true;
        expect(assets.mesh.hasEvent('unload')).to.be.true;
        expect(assets.mesh.hasEvent('change')).to.be.true;
        expect(assets.mesh.hasEvent('remove')).to.be.true;

        e.destroy();

        expect(assets.mesh.hasEvent('load')).to.be.false;
        expect(assets.mesh.hasEvent('unload')).to.be.false;
        expect(assets.mesh.hasEvent('change')).to.be.false;
        expect(assets.mesh.hasEvent('remove')).to.be.false;
    });

    it('Mesh Asset unbinds on reset', function () {
        const e = new Entity();
        app.root.addChild(e);
        e.addComponent('particlesystem', {
            meshAsset: assets.mesh.id
        });

        expect(assets.mesh.hasEvent('load')).to.be.true;
        expect(assets.mesh.hasEvent('unload')).to.be.true;
        expect(assets.mesh.hasEvent('change')).to.be.true;
        expect(assets.mesh.hasEvent('remove')).to.be.true;

        e.particlesystem.meshAsset = null;

        expect(assets.mesh.hasEvent('load')).to.be.false;
        expect(assets.mesh.hasEvent('unload')).to.be.false;
        expect(assets.mesh.hasEvent('change')).to.be.false;
        expect(assets.mesh.hasEvent('remove')).to.be.false;
    });
});
