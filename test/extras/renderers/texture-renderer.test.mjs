import { expect } from 'chai';
import sinon from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { TextureRenderer } from '../../../src/extras/renderers/texture-renderer.js';
import { Entity } from '../../../src/framework/entity.js';
import { FILTER_NEAREST, PIXELFORMAT_DEPTH, PIXELFORMAT_R32F, PIXELFORMAT_R8, PIXELFORMAT_RGBA8 } from '../../../src/platform/graphics/constants.js';
import { RenderTarget } from '../../../src/platform/graphics/render-target.js';
import { Texture } from '../../../src/platform/graphics/texture.js';
import { RenderPassForward } from '../../../src/scene/renderer/render-pass-forward.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('TextureRenderer', function () {
    let app;
    let renderer;
    let texture;
    let other;
    let layer;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        // The null backend does not bind render targets. Mirror the GPU backends so layer
        // callbacks observe the target of each real frame-graph pass.
        sinon.stub(app.graphicsDevice, 'startRenderPass').callsFake((pass) => {
            app.graphicsDevice.renderTarget = pass.renderTarget ?? app.graphicsDevice.backBuffer;
        });
        renderer = new TextureRenderer(app);
        texture = new Texture(app.graphicsDevice, { width: 4, height: 4, format: PIXELFORMAT_RGBA8 });
        other = new Texture(app.graphicsDevice, { width: 4, height: 4, format: PIXELFORMAT_R32F });
        layer = app.scene.defaultDrawLayer;
    });

    afterEach(function () {
        renderer.destroy();
        texture.destroy();
        other.destroy();
        app.destroy();
        sinon.restore();
        jsdomTeardown();
    });

    it('places a depth-independent quad using normalized top-left coordinates', function () {
        renderer.draw(texture, 0.25, 0.125, 0.5, 0.25);
        const [instance] = layer.meshInstances;
        expect(instance.node.getLocalPosition().toArray()).to.deep.equal([0, 0.5, 0]);
        expect(instance.node.getLocalScale().toArray()).to.deep.equal([1, -0.5, 1]);
        expect(instance.cull).to.equal(false);
        expect(instance.material.depthTest).to.equal(false);
        expect(instance.material.depthWrite).to.equal(false);
        expect(layer.shadowCasters).to.not.include(instance);
    });

    function createCamera(name, priority = 0) {
        const entity = new Entity(name);
        entity.addComponent('camera', { priority, frustumCulling: false });
        app.root.addChild(entity);
        return entity.camera;
    }

    function createPass(camera, target) {
        const pass = new RenderPassForward(app.graphicsDevice, app.scene.layers, app.scene, app.renderer);
        pass.init(target);
        pass.addLayer(camera, layer, true);
        return pass;
    }

    function recordDraws() {
        const draws = [];
        // Exercise app.render(), culling, layer events and shader preparation. Only GPU draw
        // submission is replaced because this suite uses the null graphics device.
        sinon.stub(app.renderer, 'renderForwardInternal').callsFake((camera, prepared) => {
            for (const instance of prepared.drawCalls) {
                draws.push({ camera: camera.node.camera, target: app.graphicsDevice.renderTarget, instance });
            }
        });
        return draws;
    }

    it('skips feedback draws against actual pass targets and restores drawing in later passes', function () {
        const camera = createCamera('Preview camera');
        const toTexture = new RenderTarget({ colorBuffer: texture, depth: false });
        const toOther = new RenderTarget({ colorBuffer: other, depth: false });
        camera.framePasses = [createPass(camera, toTexture), createPass(camera, toOther), createPass(camera, null)];
        const draws = recordDraws();
        renderer.draw(texture, 0.25, 0.125, 0.5, 0.25);
        const [instance] = layer.meshInstances;
        const prepareShader = sinon.spy(instance, 'getShaderInstance');

        // CameraFrame and custom passes can override a camera whose own target is null.
        expect(camera.renderTarget).to.equal(null);
        app.render();
        expect(draws.map(draw => draw.target)).to.deep.equal([toOther, app.graphicsDevice.backBuffer]);
        expect(draws.every(draw => draw.instance === instance)).to.equal(true);
        expect(prepareShader.callCount).to.equal(2);
        expect(instance.node.getLocalScale().toArray()).to.deep.equal([1, -0.5, 1]);
        expect(instance.shaderPassMask).to.equal(0);

        camera.framePasses.forEach(pass => pass.destroy());
        camera.framePasses = [];
        toTexture.destroy();
        toOther.destroy();
    });

    it('excludes previews of later MRT color and resolve attachments and depth attachments', function () {
        const depth = new Texture(app.graphicsDevice, { width: 4, height: 4, format: PIXELFORMAT_DEPTH, mipmaps: false, minFilter: FILTER_NEAREST, magFilter: FILTER_NEAREST });
        const third = new Texture(app.graphicsDevice, { width: 4, height: 4, format: PIXELFORMAT_RGBA8 });
        const camera = createCamera('Attachment camera');
        const colorLater = new RenderTarget({ colorBuffers: [third, texture], depth: false });
        const resolveLater = new RenderTarget({ colorBuffers: [third, other], depth: false });
        // Explicit multisampled textures are WebGPU-only. Supply the resolve attachment for the
        // null device while exercising the actual render-pass sequence.
        sinon.stub(resolveLater, 'getResolveBuffer').callsFake(index => (index === 1 ? texture : null));
        const depthTarget = new RenderTarget({ colorBuffer: other, depthBuffer: depth });
        const depthResolveTarget = new RenderTarget({ colorBuffer: third, depth: false });
        sinon.stub(depthResolveTarget, 'depthResolveBuffer').get(() => other);
        const targets = [colorLater, resolveLater, depthTarget, depthResolveTarget];
        camera.framePasses = targets.map(target => createPass(camera, target));
        const draws = recordDraws();
        renderer.draw(texture, 0, 0, 1, 1);
        renderer.draw(depth, 0, 0, 1, 1);
        renderer.draw(other, 0, 0, 1, 1);
        const [color, raw, resolvedDepth] = layer.meshInstances;
        app.render();
        expect(draws.filter(draw => draw.instance === color).map(draw => draw.target)).to.deep.equal([depthTarget, depthResolveTarget]);
        expect(draws.filter(draw => draw.instance === raw).map(draw => draw.target)).to.deep.equal([colorLater, resolveLater, depthResolveTarget]);
        expect(draws.filter(draw => draw.instance === resolvedDepth).map(draw => draw.target)).to.deep.equal([colorLater]);

        camera.framePasses.forEach(pass => pass.destroy());
        camera.framePasses = [];
        targets.forEach(target => target.destroy());
        depth.destroy();
        third.destroy();
    });

    it('does not prepare scene-depth shaders for excluded cameras and follows selection across frames', function () {
        const excluded = createCamera('Excluded');
        const selected = createCamera('Selected', 1);
        renderer.layer = layer = app.scene.layers.getLayerByName('UI');
        renderer.camera = selected;
        const draws = recordDraws();
        renderer.draw(texture, 0, 0, 1, 1);
        renderer.sceneDepth(0, 0, 1, 1);
        const [preview, depth] = layer.meshInstances;
        const prepareDepthShader = sinon.spy(depth, 'getShaderInstance');
        app.render();
        expect(draws.map(draw => draw.camera)).to.deep.equal([selected, selected]);
        expect(prepareDepthShader.calledOnce).to.equal(true);
        expect(preview.shaderPassMask).to.equal(0);
        expect(depth.shaderPassMask).to.equal(0);

        // Changing selection and reusing a slot must not retain the previous camera or texture.
        draws.length = 0;
        renderer.camera = excluded;
        renderer.draw(other, 0, 0, 1, 1);
        app.render();
        expect(draws.map(draw => draw.camera)).to.deep.equal([excluded]);
        expect(prepareDepthShader.calledOnce).to.equal(true);
        expect(preview.material.getParameter('colorMap').data).to.equal(null);

        draws.length = 0;
        renderer.camera = null;
        renderer.draw(texture, 0, 0, 1, 1);
        app.render();
        expect(draws.map(draw => draw.camera)).to.deep.equal([excluded, selected]);
    });

    it('reuses slots by submission order with unique materials and a shared mesh', function () {
        renderer.draw(texture, 0, 0, 0.5, 1);
        renderer.draw(other, 0.5, 0, 0.5, 1);
        const [first, second] = layer.meshInstances;
        const firstMaterial = first.material;
        expect(first.mesh).to.equal(second.mesh);
        expect(firstMaterial).to.not.equal(second.material);
        const add = sinon.spy(layer, 'addMeshInstances');
        const remove = sinon.spy(layer, 'removeMeshInstances');
        for (let i = 0; i < 10; i++) {
            app.fire('postrender');
            renderer.draw(other, 0, 0, 1, 1);
            renderer.draw(texture, 0, 0, 1, 1);
        }
        expect(layer.meshInstances).to.deep.equal([first, second]);
        expect(first.material).to.equal(firstMaterial);
        expect(first.material.getParameter('colorMap').data).to.equal(other);
        expect(second.material.getParameter('colorMap').data).to.equal(texture);
        expect(add.called).to.equal(false);
        expect(remove.called).to.equal(false);
    });

    it('hides unused previews and releases source references after rendering', function () {
        renderer.draw(texture, 0, 0, 1, 1);
        renderer.draw(texture, 0, 0, 1, 1);
        const [first, second] = layer.meshInstances;
        app.fire('postrender');
        expect(first.visible).to.equal(false);
        expect(first.material.getParameter('colorMap').data).to.equal(null);
        renderer.draw(other, 0, 0, 1, 1);
        expect(first.visible).to.equal(true);
        expect(second.visible).to.equal(false);
        app.fire('postrender');
        expect(first.visible).to.equal(false);
    });

    it('does not accumulate submissions on ticks where rendering is skipped', function () {
        for (let i = 0; i < 10; i++) {
            renderer.draw(texture, 0, 0, 1, 1);
            app.fire('frameend');
        }
        expect(layer.meshInstances).to.have.length(1);
        expect(layer.meshInstances[0].visible).to.equal(false);
    });

    it('keeps independent pools when switching destination layers', function () {
        const world = app.scene.layers.getLayerByName('World');
        renderer.draw(texture, 0, 0, 1, 1);
        renderer.layer = world;
        renderer.draw(other, 0, 0, 1, 1);
        const [first] = layer.meshInstances;
        const [second] = world.meshInstances;
        expect(first).to.not.equal(second);
        app.fire('postrender');
        renderer.layer = null;
        renderer.draw(other, 0, 0, 1, 1);
        expect(layer.meshInstances).to.deep.equal([first]);
        expect(second.visible).to.equal(false);
        renderer.destroy();
        expect(world.meshInstances).to.have.length(0);
        expect(layer.meshInstances).to.have.length(0);
    });

    it('can reuse a color slot for scene depth and back again', function () {
        renderer.draw(texture, 0, 0, 1, 1);
        const [instance] = layer.meshInstances;
        const colorDesc = instance.material.shaderDesc;
        app.fire('postrender');
        renderer.sceneDepth(0, 0, 1, 1);
        expect(instance.material.shaderDesc.uniqueName).to.include('scene-depth');
        expect(instance.material.getParameter('colorMap').data).to.equal(null);
        app.fire('postrender');
        renderer.draw(texture, 0, 0, 1, 1);
        expect(instance.material.shaderDesc.uniqueName).to.equal(colorDesc.uniqueName);
        expect(layer.meshInstances).to.have.length(1);
    });

    it('detects unfilterable float and raw depth sources without changing sampler state', function () {
        app.graphicsDevice.textureFloatFilterable = false;
        const filter = other.minFilter;
        renderer.draw(other, 0, 0, 1, 1);
        expect(layer.meshInstances[0].material.shaderDesc.uniqueName).to.include('unfilterable');
        expect(other.minFilter).to.equal(filter);
        const depth = new Texture(app.graphicsDevice, { format: PIXELFORMAT_DEPTH, compareOnRead: true });
        renderer.draw(depth, 0, 0, 1, 1);
        expect(layer.meshInstances[1].material.shaderDesc.uniqueName).to.include('depth');
        expect(depth.compareOnRead).to.equal(true);
        depth.destroy();
    });

    it('diagnoses invalid WebGL sampler states without changing the caller texture', function () {
        sinon.stub(app.graphicsDevice, 'isWebGL2').value(true);
        const warn = sinon.stub(Debug, 'warnOnce');
        const depth = new Texture(app.graphicsDevice, { format: PIXELFORMAT_DEPTH, mipmaps: false });
        const filter = depth.minFilter;
        renderer.draw(depth, 0, 0, 1, 1);
        expect(warn.calledOnce).to.equal(true);
        expect(layer.meshInstances).to.have.length(0);
        expect(depth.minFilter).to.equal(filter);
        depth.minFilter = FILTER_NEAREST;
        depth.magFilter = FILTER_NEAREST;
        renderer.draw(depth, 0, 0, 1, 1);
        expect(layer.meshInstances).to.have.length(1);
        app.fire('postrender');
        depth.compareOnRead = true;
        renderer.draw(depth, 0, 0, 1, 1);
        expect(warn.calledTwice).to.equal(true);
        expect(layer.meshInstances[0].visible).to.equal(false);
        expect(depth.compareOnRead).to.equal(true);
        depth.destroy();
    });

    it('captures channel selection independently for each draw and restores decoded color', function () {
        expect(renderer.channels).to.equal('rgb');
        renderer.channels = 'rrr';
        renderer.draw(texture, 0, 0, 0.5, 1);
        renderer.channels = 'aaa';
        renderer.draw(texture, 0.5, 0, 0.5, 1);
        const [first, second] = layer.meshInstances;
        expect(Array.from(first.material.getParameter('textureChannels').data)).to.deep.equal([0, 0, 0]);
        expect(Array.from(second.material.getParameter('textureChannels').data)).to.deep.equal([3, 3, 3]);
        expect(first.material.shaderDesc.uniqueName).to.equal('TextureRenderer-filtered-raw');
        app.fire('postrender');
        renderer.channels = 'rgb';
        renderer.draw(texture, 0, 0, 1, 1);
        expect(first.material.shaderDesc.uniqueName).to.equal('TextureRenderer-filtered-srgb');
    });

    it('shows single-channel formats as grayscale with the default selection', function () {
        const single = new Texture(app.graphicsDevice, { width: 4, height: 4, format: PIXELFORMAT_R8 });
        renderer.draw(single, 0, 0, 0.5, 1);
        renderer.draw(texture, 0.5, 0, 0.5, 1);
        const [gray, color] = layer.meshInstances;
        expect(gray.material.shaderDesc.uniqueName).to.equal('TextureRenderer-filtered-raw');
        expect(Array.from(gray.material.getParameter('textureChannels').data)).to.deep.equal([0, 0, 0]);
        expect(color.material.shaderDesc.uniqueName).to.equal('TextureRenderer-filtered-srgb');

        // an explicit selection still wins
        app.fire('postrender');
        renderer.channels = 'aaa';
        renderer.draw(single, 0, 0, 1, 1);
        expect(Array.from(gray.material.getParameter('textureChannels').data)).to.deep.equal([3, 3, 3]);
        single.destroy();
    });

    it('rejects invalid channel strings without changing the current selection', function () {
        const warn = sinon.stub(Debug, 'warnOnce');
        renderer.channels = 'bgr';
        for (const value of ['', 'r', 'rgba', 'RGB', 'xyz', null, 123]) {
            renderer.channels = value;
            expect(renderer.channels).to.equal('bgr');
        }
        expect(warn.callCount).to.equal(7);
    });

    it('ignores channel selection for raw and scene depth', function () {
        const depth = new Texture(app.graphicsDevice, { format: PIXELFORMAT_DEPTH });
        renderer.channels = 'aaa';
        renderer.draw(depth, 0, 0, 1, 1);
        renderer.sceneDepth(0, 0, 1, 1);
        expect(layer.meshInstances[0].material.shaderDesc.uniqueName).to.equal('TextureRenderer-depth-linear');
        expect(layer.meshInstances[1].material.shaderDesc.uniqueName).to.equal('TextureRenderer-scene-depth-linear');
        depth.destroy();
    });

    it('ignores zero-size and non-finite rectangles without allocating resources', function () {
        renderer.draw(texture, 0, 0, 0, 1);
        renderer.draw(texture, NaN, 0, 1, 1);
        renderer.sceneDepth(0, 0, 1, Infinity);
        expect(layer.meshInstances).to.have.length(0);
    });

    it('destroys owned resources once, without destroying caller textures', function () {
        renderer.draw(texture, 0, 0, 1, 1);
        renderer.draw(other, 0, 0, 1, 1);
        const [first, second] = layer.meshInstances;
        const meshDestroy = sinon.spy(first.mesh, 'destroy');
        const materialDestroy = sinon.spy(first.material, 'destroy');
        const secondMaterialDestroy = sinon.spy(second.material, 'destroy');
        const textureDestroy = sinon.spy(texture, 'destroy');
        app.fire('destroy');
        renderer.destroy();
        renderer.draw(texture, 0, 0, 1, 1);
        renderer.sceneDepth(0, 0, 1, 1);
        expect(layer.meshInstances).to.have.length(0);
        expect(meshDestroy.calledOnce).to.equal(true);
        expect(materialDestroy.calledOnce).to.equal(true);
        expect(secondMaterialDestroy.calledOnce).to.equal(true);
        expect(textureDestroy.called).to.equal(false);
        expect(app.scene.hasEvent('prerender:layer')).to.equal(false);
        expect(app.scene.hasEvent('postrender:layer')).to.equal(false);
    });
});
