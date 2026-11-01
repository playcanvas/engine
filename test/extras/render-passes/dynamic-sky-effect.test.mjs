import { expect } from 'chai';
import { restore, spy, stub } from 'sinon';

import { Debug } from '../../../src/core/debug.js';
import { Color } from '../../../src/core/math/color.js';
import { Vec3 } from '../../../src/core/math/vec3.js';
import { Preprocessor } from '../../../src/core/preprocessor.js';
import { DynamicSkyEffect } from '../../../src/extras/effects/dynamic-sky/dynamic-sky-effect.js';
import { CameraFrame } from '../../../src/extras/render-passes/camera-frame.js';
import { CLOUDTYPE_FLAT, CLOUDTYPE_NONE, CLOUDTYPE_VOLUMETRIC } from '../../../src/extras/render-passes/constants.js';
import { Entity } from '../../../src/framework/entity.js';
import { SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL, TYPE_FLOAT32 } from '../../../src/platform/graphics/constants.js';
import { VertexFormat } from '../../../src/platform/graphics/vertex-format.js';
import { FOG_EXP, LAYERID_SKYBOX, PROJECTION_ORTHOGRAPHIC, SHADER_FORWARD } from '../../../src/scene/constants.js';
import { FogParams } from '../../../src/scene/fog-params.js';
import { LightList } from '../../../src/scene/lighting/light-list.js';
import { StandardMaterial } from '../../../src/scene/materials/standard-material.js';
import { shaderChunksGLSL } from '../../../src/scene/shader-lib/glsl/collections/shader-chunks-glsl.js';
import { ShaderChunks } from '../../../src/scene/shader-lib/shader-chunks.js';
import { shaderChunksWGSL } from '../../../src/scene/shader-lib/wgsl/collections/shader-chunks-wgsl.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('DynamicSkyEffect', function () {

    /** @type {import('../../../src/framework/application.js').Application} */
    let app;

    /** @type {CameraFrame} */
    let cameraFrame;

    /** @type {DynamicSkyEffect} */
    let sky;

    const createCamera = (name) => {
        const entity = new Entity(name);
        entity.addComponent('camera');
        app.root.addChild(entity);
        return entity.camera;
    };

    const skyLayer = () => app.scene.layers.getLayerById(LAYERID_SKYBOX);

    // the frame graph is not rendered, so the frame is prepared by hand
    const frameUpdate = () => cameraFrame.renderPassCamera.frameUpdate();

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        cameraFrame = new CameraFrame(app, createCamera('Camera'));
        sky = new DynamicSkyEffect(app.graphicsDevice);
        stub(Debug, 'warnOnce');
    });

    afterEach(function () {
        sky.destroy();
        cameraFrame.destroy();
        app.destroy();
        jsdomTeardown();
        restore();
    });

    describe('sky', function () {

        it('renders the sky of its camera in place of the sky of the scene', function () {
            const other = createCamera('Other');
            cameraFrame.addEffect(sky);
            cameraFrame.update();

            const { camera } = cameraFrame.cameraComponent;
            expect(camera.skyVisible).to.equal(false);
            expect(other.camera.skyVisible).to.equal(true);

            const meshInstance = sky._meshInstance;
            expect(skyLayer().meshInstances).to.include(meshInstance);
            expect(meshInstance.cull).to.equal(true);
            expect(meshInstance.isVisibleFunc(camera)).to.equal(true);
            expect(meshInstance.isVisibleFunc(other.camera)).to.equal(false);
        });

        it('leaves the sky to the scene from the update after it is removed', function () {
            cameraFrame.addEffect(sky);
            cameraFrame.update();
            const { camera } = cameraFrame.cameraComponent;
            const meshInstance = sky._meshInstance;

            // still rendering its sky until the update
            cameraFrame.removeEffect(sky);
            expect(meshInstance.isVisibleFunc(camera)).to.equal(true);
            expect(() => cameraFrame.renderPassCamera.frameUpdate()).to.not.throw();

            cameraFrame.update();
            expect(camera.skyVisible).to.equal(true);
            expect(meshInstance.isVisibleFunc(camera)).to.equal(false);
        });

        it('leaves the sky to the scene while the camera frame is disabled', function () {
            cameraFrame.addEffect(sky);
            cameraFrame.update();
            const { camera } = cameraFrame.cameraComponent;

            cameraFrame.enabled = false;
            expect(camera.skyVisible).to.equal(true);
            expect(sky._meshInstance.isVisibleFunc(camera)).to.equal(false);

            cameraFrame.enabled = true;
            expect(camera.skyVisible).to.equal(false);
            expect(sky._meshInstance.isVisibleFunc(camera)).to.equal(true);
        });
    });

    describe('atmosphere', function () {

        it('keeps the scattering positive and the phase finite at the ends of the ranges', function () {
            sky.rayleigh = 0;
            sky.turbidity = -1;
            sky.mieCoefficient = -0.01;
            sky.mieDirectionalG = 1;
            sky.elevation = -3;
            cameraFrame.addEffect(sky);
            cameraFrame.update();

            for (let i = 0; i < 3; i++) {
                expect(sky._betaR[i]).to.be.above(0);
                expect(sky._betaM[i]).to.equal(0);
            }
            expect(sky._skyUniforms.get('dynSkyMieG')).to.be.below(1);
        });

        it('sets the uniforms of its sky on the device every frame, for the shaders of other materials', function () {
            sky.elevation = 30;
            cameraFrame.addEffect(sky);
            cameraFrame.update();
            frameUpdate();

            const scope = app.graphicsDevice.scope;
            const names = ['dynSkySunDir', 'dynSkyBetaR', 'dynSkyBetaM', 'dynSkySunE', 'dynSkyMieG', 'dynSkyLuminance',
                'dynSkyNightBlend', 'dynSkyNightColor', 'dynSkyNightParams', 'dynSkyRotation'];
            for (const name of names) {
                expect(scope.resolve(name).value, name).to.equal(sky._skyUniforms.get(name));
            }

            // a change of the sky reaches the device on the next frame
            sky.elevation = -10;
            cameraFrame.update();
            frameUpdate();
            expect(scope.resolve('dynSkyNightBlend').value).to.equal(1);
        });

        it('gets the color of the day sky in a direction - blue above, and brightest towards a low sun', function () {
            sky.elevation = 60;
            cameraFrame.addEffect(sky);
            cameraFrame.update();

            // before the first frame too, and for a direction of any length
            const zenith = sky.getSkyColor(new Vec3(0, 5, 0));
            expect(zenith.b).to.be.above(zenith.g);
            expect(zenith.g).to.be.above(zenith.r);
            expect(zenith.r).to.be.above(0);
            expect(sky.getSkyColor(Vec3.UP).equals(zenith)).to.equal(true);

            sky.elevation = 5;
            sky.azimuth = 90;
            cameraFrame.update();
            const luma = c => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
            const towards = sky.getSkyColor(new Vec3(1, 0.1, 0));
            const away = sky.getSkyColor(new Vec3(-1, 0.1, 0));
            expect(luma(towards)).to.be.above(luma(away) * 2);
        });

        it('gets the color of the night sky in a direction, its gradient without the lights', function () {
            sky.elevation = -20;
            sky.nightColor = new Color(0.1, 0.2, 0.4);
            sky.nightBrightness = 0.5;
            cameraFrame.addEffect(sky);
            cameraFrame.update();

            // straight up, the gradient is at its darkest, and the afterglow of the sunset is gone
            const color = sky.getSkyColor(Vec3.UP);
            expect(color.r).to.be.closeTo(0.1 * 0.5 * 0.4, 1e-6);
            expect(color.g).to.be.closeTo(0.2 * 0.5 * 0.4, 1e-6);
            expect(color.b).to.be.closeTo(0.4 * 0.5 * 0.4, 1e-6);
        });
    });

    describe('haze', function () {

        // the define the camera sets for the fog of the haze
        const HAZE = 'DYNAMICSKYHAZE';

        // the forward fragment shader of a material, as the camera of the camera frame renders it -
        // with the fog of the camera, which the renderer gives its shader parameters each frame
        const fragmentSource = (material) => {
            const device = app.graphicsDevice;
            const { camera, shaderParams } = cameraFrame.cameraComponent;
            shaderParams.fog = (camera.fogParams ?? app.scene.fog).type;
            material.update();
            const shader = material.getShaderVariant({
                device,
                scene: app.scene,
                objDefs: 0,
                pass: SHADER_FORWARD,
                cameraShaderParams: shaderParams,
                viewUniformFormat: app.renderer.getViewUniformFormat(false, new LightList()),
                vertexFormat: new VertexFormat(device, [
                    { semantic: SEMANTIC_POSITION, components: 3, type: TYPE_FLOAT32 }
                ])
            });
            expect(shader.failed).to.equal(false);
            return shader.definition.fshader;
        };

        it('hazes the lit materials of its camera alone, and only while enabled', function () {
            const other = createCamera('Other');
            const material = new StandardMaterial();
            cameraFrame.addEffect(sky);
            cameraFrame.update();
            const cameraComponent = cameraFrame.cameraComponent;
            expect(cameraComponent.fog).to.equal(null);
            expect(fragmentSource(material)).to.not.include('dynamicSkyHazeAmount');

            // the material compiled before the haze is hazed too
            sky.haze = true;
            cameraFrame.update();
            expect(cameraComponent.fog.type.toUpperCase()).to.equal(HAZE);
            expect(other.fog).to.equal(null);
            expect(fragmentSource(material)).to.include('dynamicSkyHazeAmount');

            sky.haze = false;
            cameraFrame.update();
            expect(cameraComponent.fog).to.equal(null);
            expect(fragmentSource(material)).to.not.include('dynamicSkyHazeAmount');
        });

        it('renders the materials opting out of the haze without fog', function () {
            sky.haze = true;
            cameraFrame.addEffect(sky);
            cameraFrame.update();

            const noFog = new StandardMaterial();
            noFog.useFog = false;
            expect(fragmentSource(noFog)).to.not.include('dynamicSkyHazeAmount');

            const optedOut = new StandardMaterial();
            optedOut.setDefine('DYNAMIC_SKY_NO_HAZE', true);
            expect(fragmentSource(optedOut)).to.not.include('dynamicSkyHazeAmount');
        });

        it('gives the camera its fog back once disabled, removed or destroyed', function () {
            const cameraComponent = cameraFrame.cameraComponent;
            const fog = new FogParams();
            fog.type = FOG_EXP;
            cameraComponent.fog = fog;

            sky.haze = true;
            cameraFrame.addEffect(sky);
            cameraFrame.update();
            expect(cameraComponent.fog).to.not.equal(fog);

            cameraFrame.enabled = false;
            expect(cameraComponent.fog).to.equal(fog);
            cameraFrame.enabled = true;
            expect(cameraComponent.fog).to.not.equal(fog);

            cameraFrame.removeEffect(sky);
            expect(cameraComponent.fog).to.equal(fog);

            cameraFrame.addEffect(sky);
            cameraFrame.update();
            expect(cameraComponent.fog).to.not.equal(fog);
            sky.destroy();
            expect(cameraComponent.fog).to.equal(fog);
        });

        it('keeps a fog the camera was given while hazed', function () {
            sky.haze = true;
            cameraFrame.addEffect(sky);
            cameraFrame.update();

            const cameraComponent = cameraFrame.cameraComponent;
            const fog = new FogParams();
            cameraComponent.fog = fog;
            sky.haze = false;
            cameraFrame.update();
            expect(cameraComponent.fog).to.equal(fog);
        });

        it('sets the density, the falloff and the base height of the haze on the device', function () {
            sky.hazeDensity = 0.002;
            sky.hazeHeight = 500;
            sky.hazeBaseHeight = -20;
            cameraFrame.addEffect(sky);
            cameraFrame.update();
            frameUpdate();

            const value = app.graphicsDevice.scope.resolve('dynSkyHaze').value;
            expect(value[0]).to.be.closeTo(0.002, 1e-9);
            expect(value[1]).to.be.closeTo(1 / 500, 1e-9);
            expect(value[2]).to.equal(-20);

            // no negative density, and no division by a zero height
            sky.hazeDensity = -1;
            sky.hazeHeight = 0;
            cameraFrame.update();
            expect(value[0]).to.equal(0);
            expect(Number.isFinite(value[1])).to.equal(true);
        });

        it('takes the place of the fog chunk once, keeping the fog of the scene', function () {
            const device = app.graphicsDevice;
            const glsl = ShaderChunks.get(device, SHADERLANGUAGE_GLSL);
            const wgsl = ShaderChunks.get(device, SHADERLANGUAGE_WGSL);
            const fog = glsl.get('fogPS');
            expect(fog).to.include(HAZE);

            // a second sky does not wrap the fog chunk of the first
            const second = new DynamicSkyEffect(device);
            expect(glsl.get('fogPS')).to.equal(fog);
            expect(glsl.get('dynamicSkySceneFogPS')).to.equal(shaderChunksGLSL.fogPS);
            expect(wgsl.get('dynamicSkySceneFogPS')).to.equal(shaderChunksWGSL.fogPS);
            second.destroy();
        });

        it('hazes the lit fragment shaders alone - the particles and the gaussian splats render without fog', function () {
            for (const language of [SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL]) {
                const chunks = ShaderChunks.get(app.graphicsDevice, language);
                const fog = (defines) => {
                    const source = `${defines.map(name => `#define ${name}\n`).join('')}${chunks.get('fogPS')}`;
                    return Preprocessor.run(source, chunks);
                };

                const hazed = `FOG ${HAZE}`;
                expect(fog([hazed, 'LIT_BLEND_TYPE NORMAL']), language).to.include('dynamicSkyHazeAmount');
                expect(fog([hazed, 'LIT_BLEND_TYPE NORMAL', 'DYNAMIC_SKY_NO_HAZE']), language).to.not.include('dynamicSkyHazeAmount');

                // the others pass the color through, in both stages
                for (const stage of [[], ['VERTEXSHADER']]) {
                    const source = fog([hazed, ...stage]);
                    expect(source, language).to.not.include('dynamicSkyHazeAmount');
                    expect(source, language).to.not.include('fog_color');
                    expect(source, language).to.include('addFog');
                }

                // the other types of fog are the fog of the scene
                const scene = fog(['FOG EXP', 'LIT_BLEND_TYPE NORMAL']);
                expect(scene, language).to.not.include('dynamicSkyHazeAmount');
                expect(scene, language).to.include('fog_density');
            }
        });
    });

    describe('clouds', function () {

        it('has no clouds by default, and removes the volumetric clouds when they are set back to none', function () {
            expect(sky.cloudType).to.equal(CLOUDTYPE_NONE);
            cameraFrame.addEffect(sky);
            cameraFrame.update();
            expect(sky._cloudPass).to.equal(null);
            expect(sky._material.getDefine('DYNSKY_CLOUDS_FLAT')).to.equal(false);
            expect(sky._material.getDefine('DYNSKY_CLOUDS_VOLUMETRIC')).to.equal(false);

            sky.cloudType = CLOUDTYPE_VOLUMETRIC;
            cameraFrame.update();
            expect(sky._cloudPass).to.not.equal(null);

            sky.cloudType = CLOUDTYPE_NONE;
            cameraFrame.update();
            expect(sky._cloudPass).to.equal(null);
            expect(sky._material.getDefine('DYNSKY_CLOUDS_VOLUMETRIC')).to.equal(false);
            expect(sky._material.getDefine('DYNSKY_CLOUDS_BUFFER')).to.equal(false);
        });

        it('renders the volumetric clouds at a reduced resolution of the scene, before it', function () {
            sky.cloudType = CLOUDTYPE_VOLUMETRIC;
            sky.cloudResolution = 0.5;
            cameraFrame.addEffect(sky);
            cameraFrame.update();

            const framePass = cameraFrame.renderPassCamera;
            const passes = framePass.beforePasses;
            const pass = sky._cloudPass;
            expect(pass).to.not.equal(null);
            expect(passes.indexOf(pass)).to.be.below(passes.indexOf(framePass.scenePass));

            frameUpdate();
            const context = framePass._effectContext;
            expect(sky._cloudTarget.width).to.equal(Math.round(context.renderWidth * 0.5));
            expect(sky._cloudTarget.height).to.equal(Math.round(context.renderHeight * 0.5));

            const material = sky._material;
            expect(material.getDefine('DYNSKY_CLOUDS_VOLUMETRIC')).to.equal(true);
            expect(material.getDefine('DYNSKY_CLOUDS_BUFFER')).to.equal(true);
        });

        it('renders the volumetric clouds to their texture at the full resolution too', function () {
            sky.cloudType = CLOUDTYPE_VOLUMETRIC;
            sky.cloudResolution = 1;
            cameraFrame.addEffect(sky);
            cameraFrame.update();
            expect(sky._cloudPass).to.not.equal(null);

            frameUpdate();
            const context = cameraFrame.renderPassCamera._effectContext;
            expect(sky._cloudTarget.width).to.equal(context.renderWidth);
            expect(sky._cloudTarget.height).to.equal(context.renderHeight);
            expect(sky._material.getDefine('DYNSKY_CLOUDS_BUFFER')).to.equal(true);
        });

        it('evaluates the volumetric clouds in the sky of an orthographic camera, and the flat clouds always', function () {
            sky.cloudType = CLOUDTYPE_VOLUMETRIC;
            cameraFrame.cameraComponent.projection = PROJECTION_ORTHOGRAPHIC;
            cameraFrame.addEffect(sky);
            cameraFrame.update();
            expect(sky._cloudPass).to.equal(null);
            expect(sky._material.getDefine('DYNSKY_CLOUDS_VOLUMETRIC')).to.equal(true);
            expect(sky._material.getDefine('DYNSKY_CLOUDS_BUFFER')).to.equal(false);

            sky.cloudType = CLOUDTYPE_FLAT;
            sky.cloudResolution = 0.5;
            cameraFrame.update();
            expect(sky._cloudPass).to.equal(null);
            expect(sky._material.getDefine('DYNSKY_CLOUDS_FLAT')).to.equal(true);
            expect(sky._material.getDefine('DYNSKY_CLOUDS_VOLUMETRIC')).to.equal(false);
        });

        it('drifts the clouds with the time of the application', function () {
            sky.cloudType = CLOUDTYPE_FLAT;
            sky.windSpeed = 20;
            sky.windDirection = 0;
            sky.cloudSize = 1000;
            cameraFrame.addEffect(sky);
            cameraFrame.update();
            frameUpdate();
            const start = sky._cloudOffset[0];

            // a frame rendered without the application updating does not move them
            frameUpdate();
            expect(sky._cloudOffset[0]).to.equal(start);

            // a second at 20 m/s moves them by 20 m, a fiftieth of the pattern
            app.update(1);
            frameUpdate();
            expect(sky._cloudOffset[0] - start).to.be.closeTo(0.02, 1e-6);
        });
    });

    describe('generating the lighting', function () {

        it('renders the sky to the cubemap and prefilters it, for each type of the clouds', function () {
            const effect = sky;
            const bake = () => effect._lightingPass.execute();
            cameraFrame.addEffect(effect);
            for (const type of [CLOUDTYPE_NONE, CLOUDTYPE_FLAT, CLOUDTYPE_VOLUMETRIC]) {
                effect.cloudType = type;
                cameraFrame.update();
                frameUpdate();
                expect(bake).to.not.throw();
                expect(effect._bakeRequested).to.equal(false);
            }
            expect(effect._bakeShaders.size).to.equal(3);
        });
    });

    describe('lighting', function () {

        // the lighting is generated by its pass, on the frames it is due
        const due = () => sky._lightingPass.executeEnabled;

        beforeEach(function () {
            stub(sky, '_bakeLighting').callsFake(function () {
                this._bakeRequested = false;
                this._bakeDue = false;
                this._driftSinceBake = 0;
                this._bakedSkyDir.copy(this._skyDir);
                this._bakedMoonDir.copy(this._moonWorldDir);
                this._bakedSettings.set(this._settings);
            });
        });

        it('lights the scene with the environment atlas it generates from the sky', function () {
            cameraFrame.addEffect(sky);
            cameraFrame.update();
            expect(app.scene.envAtlas).to.equal(sky._envAtlas);
            expect(sky._envAtlas.width).to.equal(sky.atlasSize);
            expect(sky._lightingSource.width).to.equal(sky.lightingResolution);

            frameUpdate();
            expect(due()).to.equal(true);
        });

        it('generates the lighting again when the sun moves by the threshold', function () {
            sky.elevation = 30;
            cameraFrame.addEffect(sky);
            cameraFrame.update();
            frameUpdate();
            sky._bakeLighting();

            sky.elevation = 30.2;
            cameraFrame.update();
            frameUpdate();
            expect(due()).to.equal(false);

            sky.elevation = 31;
            cameraFrame.update();
            frameUpdate();
            expect(due()).to.equal(true);
        });

        it('generates the lighting again when its settings change, and on request', function () {
            cameraFrame.addEffect(sky);
            cameraFrame.update();
            frameUpdate();
            sky._bakeLighting();

            sky.turbidity = 5;
            cameraFrame.update();
            frameUpdate();
            expect(due()).to.equal(true);
            sky._bakeLighting();

            cameraFrame.update();
            frameUpdate();
            expect(due()).to.equal(false);
            sky.bakeLighting();
            frameUpdate();
            expect(due()).to.equal(true);
        });

        it('generates the lighting again once a setting animated in small steps changed by a percent', function () {
            sky.luminance = 1;
            cameraFrame.addEffect(sky);
            cameraFrame.update();
            frameUpdate();
            sky._bakeLighting();

            // two steps of half a percent each, the second adding up to more than a percent
            sky.luminance = 1.006;
            cameraFrame.update();
            frameUpdate();
            expect(due()).to.equal(false);

            sky.luminance = 1.012;
            cameraFrame.update();
            frameUpdate();
            expect(due()).to.equal(true);
        });

        it('generates the lighting again as the clouds drift only with the cloud threshold set', function () {
            sky.cloudType = CLOUDTYPE_FLAT;
            sky.windSpeed = 10;
            sky.cloudSize = 1000;
            cameraFrame.addEffect(sky);
            cameraFrame.update();
            frameUpdate();
            sky._bakeLighting();

            // ten seconds drift the clouds by a tenth of their size
            for (let i = 0; i < 100; i++) app.update(0.1);
            cameraFrame.update();
            frameUpdate();
            expect(due()).to.equal(false);

            sky.lightingCloudThreshold = 0.05;
            cameraFrame.update();
            frameUpdate();
            expect(due()).to.equal(true);
        });

        it('generates the lighting again when the moon lighting the clouds at night changes', function () {
            sky.elevation = -25;
            sky.cloudType = CLOUDTYPE_VOLUMETRIC;
            cameraFrame.addEffect(sky);
            cameraFrame.update();
            frameUpdate();
            sky._bakeLighting();

            cameraFrame.update();
            frameUpdate();
            expect(due()).to.equal(false);

            sky.moonColor = new Color(1, 0.8, 0.6);
            cameraFrame.update();
            frameUpdate();
            expect(due()).to.equal(true);
            sky._bakeLighting();

            sky.moonDirection = new Vec3(1.2, 0.9, -0.4);
            cameraFrame.update();
            frameUpdate();
            expect(due()).to.equal(true);
            sky._bakeLighting();

            // the moon direction is turned by the rotation of the sky
            sky.rotation = 30;
            cameraFrame.update();
            frameUpdate();
            expect(due()).to.equal(true);
        });

        it('leaves the lighting of the scene alone without lighting', function () {
            sky.lighting = false;
            cameraFrame.addEffect(sky);
            cameraFrame.update();
            frameUpdate();
            expect(app.scene.envAtlas).to.equal(null);
            expect(due()).to.equal(false);
        });

        it('removes its environment atlas from the scene once destroyed', function () {
            cameraFrame.addEffect(sky);
            cameraFrame.update();
            expect(app.scene.envAtlas).to.not.equal(null);

            sky.destroy();
            expect(app.scene.envAtlas).to.equal(null);
        });
    });

    describe('lighting interpolation', function () {

        // a frame: the time passes, the camera frame updates, and the lighting pass runs when due
        const frame = (dt) => {
            app.update(dt);
            cameraFrame.update();
            frameUpdate();
            if (sky._lightingPass.executeEnabled) {
                sky._lightingPass.execute();
            }
        };

        beforeEach(function () {
            sky.lightingInterpolation = true;
            sky.elevation = 30;
            cameraFrame.addEffect(sky);
        });

        it('generates the lighting to an atlas of its own, shown at once the first time', function () {
            frame(0.1);
            expect(app.scene.envAtlas).to.equal(sky._envAtlas);
            expect(sky._atlasLatest).to.not.equal(null);
            expect(sky._atlasPrevious).to.not.equal(null);
            expect(sky._atlasLatest).to.not.equal(sky._envAtlas);
            expect(sky._blendWeight).to.equal(1);
        });

        it('blends a gradual change in over the time since the previous update', function () {
            frame(0.1);
            frame(0.1);

            // the sun moved past the threshold, 0.2 s after the previous update
            sky.elevation = 30.6;
            frame(0.1);
            expect(sky._blendDuration).to.be.closeTo(0.2, 1e-6);
            expect(sky._blendWeight).to.be.closeTo(0.5, 1e-6);

            frame(0.1);
            expect(sky._blendWeight).to.equal(1);

            // the blend is done, so the pass rests
            frame(0.1);
            expect(sky._lightingPass.executeEnabled).to.equal(false);
        });

        it('applies a jump, and an update on request, at once', function () {
            frame(0.1);
            frame(0.1);
            sky.elevation = 40;
            frame(0.1);
            expect(sky._blendWeight).to.equal(1);

            frame(0.1);
            sky.elevation = 40.6;
            frame(0.05);
            expect(sky._blendWeight).to.be.closeTo(1 / 3, 1e-6);

            sky.bakeLighting();
            frame(0.05);
            expect(sky._blendWeight).to.equal(1);
        });

        it('continues a blend in progress from the lighting shown', function () {
            frame(0.1);
            frame(0.1);
            sky.elevation = 30.6;
            frame(0.1);
            expect(sky._blendWeight).to.be.below(1);

            const copy = spy(sky._atlasPrevious, 'copy');
            sky.elevation = 31.2;
            frame(0.1);
            expect(copy.calledOnce).to.equal(true);
            expect(copy.firstCall.args[0]).to.equal(sky._envAtlas);
            expect(sky._blendDuration).to.be.closeTo(0.1, 1e-6);
        });

        it('blends for a second at most, and at once with the time paused', function () {
            frame(0.1);
            for (let i = 0; i < 50; i++) frame(0.1);
            sky.elevation = 30.6;
            frame(0.1);
            expect(sky._blendDuration).to.equal(1);
            expect(sky._blendWeight).to.be.closeTo(0.1, 1e-6);

            frame(0);
            expect(sky._blendWeight).to.equal(1);
        });

        it('releases its atlases once the lighting is no longer interpolated', function () {
            frame(0.1);
            sky.lightingInterpolation = false;
            frame(0.1);
            expect(sky._atlasLatest).to.equal(null);
            expect(sky._atlasPrevious).to.equal(null);
            expect(sky._envAtlasTarget).to.equal(null);
            expect(app.scene.envAtlas).to.equal(sky._envAtlas);
        });
    });

    describe('light', function () {

        it('keeps a directional light in sync with the sun and the moon', function () {
            const entity = new Entity('Sun');
            entity.addComponent('light', { type: 'directional' });
            app.root.addChild(entity);
            sky.light = entity.light;
            sky.sunIntensity = 2;
            sky.moonIntensity = 0.5;
            sky.azimuth = 90;
            sky.elevation = 45;
            cameraFrame.addEffect(sky);
            cameraFrame.update();

            // the light shines from the sun, down its negative Y axis
            const up = entity.getWorldTransform().getY(new Vec3()).normalize();
            const sunDir = sky._computeSunDir(new Vec3());
            expect(up.dot(sunDir)).to.be.closeTo(1, 1e-5);
            expect(entity.light.intensity).to.be.closeTo(2, 1e-6);

            // at night, from the moon at the intensity of the moonlight
            sky.elevation = -30;
            cameraFrame.update();
            const moonDir = sky._computeMoonDir(new Vec3());
            entity.getWorldTransform().getY(up).normalize();
            expect(up.dot(moonDir)).to.be.closeTo(1, 1e-5);
            expect(entity.light.intensity).to.be.closeTo(0.5, 1e-6);
        });
    });
});
