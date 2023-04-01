import React from 'react';
import * as pc from '../../../../';

import { BindingTwoWay, BooleanInput, LabelGroup, Panel, SelectInput, SliderInput } from '@playcanvas/pcui/react';
import { Observer } from '@playcanvas/observer';

class LayerMasksExample {
    static CATEGORY = 'Animation';
    static NAME = 'Layer Masks';
    static WEBGPU_ENABLED = true;

    controls(data: Observer) {
        return <>
            <Panel headerText='Full Body Layer'>
                <LabelGroup text='active state'>
                    <SelectInput options={[{ v: 'Idle', t: 'Idle' }, { v: 'Walk', t: 'Walk' }]} binding={new BindingTwoWay()} link={{ observer: data, path: 'fullBodyLayer.state' }}/>
                </LabelGroup>
            </Panel>
            <Panel headerText='Upper Body Layer'>
                <LabelGroup text='active state'>
                    <SelectInput options={[{ v: 'Eager', t: 'Eager' }, { v: 'Idle', t: 'Idle' }, { v: 'Dance', t: 'Dance' }]} binding={new BindingTwoWay()} link={{ observer: data, path: 'upperBodyLayer.state' }}/>
                </LabelGroup>
                <LabelGroup text='blend type'>
                    <SelectInput options={[{ v: pc.ANIM_LAYER_OVERWRITE, t: 'Overwrite' }, { v: pc.ANIM_LAYER_ADDITIVE, t: 'Additive' }]} value={pc.ANIM_LAYER_ADDITIVE} binding={new BindingTwoWay()} link={{ observer: data, path: 'upperBodyLayer.blendType' }}/>
                </LabelGroup>
                <LabelGroup text='use mask'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'upperBodyLayer.useMask' }}/>
                </LabelGroup>
            </Panel>
            <Panel headerText='Options'>
                <LabelGroup text='blend'>
                    <SliderInput min={0.01} max={0.99} binding={new BindingTwoWay()} link={{ observer: data, path: 'options.blend' }} value={0.5}/>
                </LabelGroup>
                <LabelGroup text='skeleton'>
                    <BooleanInput type='toggle' binding={new BindingTwoWay()} link={{ observer: data, path: 'options.skeleton' }}/>
                </LabelGroup>
            </Panel>
        </>;
    }


    example(canvas: HTMLCanvasElement, deviceType: string, data: any): void {

        const assets = {
            'model': new pc.Asset('model', 'container', { url: '/static/assets/models/bitmoji.glb' }),
            'idleAnim': new pc.Asset('idleAnim', 'container', { url: '/static/assets/animations/bitmoji/idle.glb' }),
            'idleEagerAnim': new pc.Asset('idleEagerAnim', 'container', { url: '/static/assets/animations/bitmoji/idle-eager.glb' }),
            'walkAnim': new pc.Asset('walkAnim', 'container', { url: '/static/assets/animations/bitmoji/walk.glb' }),
            'danceAnim': new pc.Asset('danceAnim', 'container', { url: '/static/assets/animations/bitmoji/win-dance.glb' }),
            helipad: new pc.Asset('helipad-env-atlas', 'texture', { url: '/static/assets/cubemaps/helipad-env-atlas.png' }, { type: pc.TEXTURETYPE_RGBP }),
            'bloom': new pc.Asset('bloom', 'script', { url: '/static/scripts/posteffects/posteffect-bloom.js' })
        };

        const gfxOptions = {
            deviceTypes: [deviceType],
            glslangUrl: '/static/lib/glslang/glslang.js',
            twgslUrl: '/static/lib/twgsl/twgsl.js'
        };

        pc.createGraphicsDevice(canvas, gfxOptions).then((device: pc.GraphicsDevice) => {

            const createOptions = new pc.AppOptions();
            createOptions.graphicsDevice = device;
            createOptions.mouse = new pc.Mouse(document.body);
            createOptions.touch = new pc.TouchDevice(document.body);

            createOptions.componentSystems = [
                // @ts-ignore
                pc.RenderComponentSystem,
                // @ts-ignore
                pc.CameraComponentSystem,
                // @ts-ignore
                pc.LightComponentSystem,
                // @ts-ignore
                pc.ScriptComponentSystem,
                // @ts-ignore
                pc.AnimComponentSystem
            ];
            createOptions.resourceHandlers = [
                // @ts-ignore
                pc.TextureHandler,
                // @ts-ignore
                pc.ContainerHandler,
                // @ts-ignore
                pc.ScriptHandler,
                // @ts-ignore
                pc.AnimClipHandler,
                // @ts-ignore
                pc.AnimStateGraphHandler
            ];

            const app = new pc.AppBase(canvas);
            app.init(createOptions);

            // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
            app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc.RESOLUTION_AUTO);

            const assetListLoader = new pc.AssetListLoader(Object.values(assets), app.assets);
            assetListLoader.load(() => {

                // setup data
                data.set('fullBodyLayer', {
                    state: 'Idle',
                    blendType: pc.ANIM_LAYER_OVERWRITE
                });
                data.set('upperBodyLayer', {
                    state: 'Eager',
                    blendType: pc.ANIM_LAYER_ADDITIVE,
                    useMask: true
                });
                data.set('options', {
                    blend: 0.5,
                    skeleton: true
                });

                // setup skydome
                app.scene.exposure = 2;
                app.scene.skyboxMip = 2;
                app.scene.envAtlas = assets.helipad.resource;

                // Create an Entity with a camera component
                const cameraEntity = new pc.Entity();
                cameraEntity.addComponent("camera", {
                    clearColor: new pc.Color(0.1, 0.1, 0.1)
                });
                cameraEntity.translate(0, 0.75, 3);

                // add bloom postprocessing (this is ignored by the picker)
                cameraEntity.addComponent("script");
                cameraEntity.script.create("bloom", {
                    attributes: {
                        bloomIntensity: 1,
                        bloomThreshold: 0.7,
                        blurAmount: 4
                    }
                });
                app.root.addChild(cameraEntity);

                // Create an entity with a light component
                const lightEntity = new pc.Entity();
                lightEntity.addComponent("light", {
                    castShadows: true,
                    intensity: 1.5,
                    normalOffsetBias: 0.02,
                    shadowType: pc.SHADOW_PCF5,
                    shadowDistance: 6,
                    shadowResolution: 2048,
                    shadowBias: 0.02
                });
                app.root.addChild(lightEntity);
                lightEntity.setLocalEulerAngles(45, 30, 0);

                // create an entity from the loaded model using the render component
                const modelEntity = assets.model.resource.instantiateRenderEntity({
                    castShadows: true
                });
                modelEntity.addComponent('anim', {
                    activate: true
                });
                app.root.addChild(modelEntity);

                // retrieve the animation assets
                const idleTrack = assets.idleAnim.resource.animations[0].resource;
                const walkTrack = assets.walkAnim.resource.animations[0].resource;
                const danceTrack = assets.danceAnim.resource.animations[0].resource;
                const idleEagerTrack = assets.idleEagerAnim.resource.animations[0].resource;

                // create the full body layer by assigning full body animations to the anim component
                modelEntity.anim.assignAnimation('Idle', idleTrack);
                modelEntity.anim.assignAnimation('Walk', walkTrack);

                // set the default weight for the base layer
                modelEntity.anim.baseLayer.weight = 1.0 - data.get('options.blend');

                // create a mask for the upper body layer
                const upperBodyMask = {
                    // set a path with the children property as true to include that path and all of its children in the mask
                    'RootNode/AVATAR/C_spine0001_bind_JNT/C_spine0002_bind_JNT': {
                        children: true
                    },
                    // set a path to true in the mask to include only that specific path
                    'RootNode/AVATAR/C_spine0001_bind_JNT/C_spine0002_bind_JNT/C_Head': true
                };

                // create a new layer for the upper body, with additive layer blending
                const upperBodyLayer = modelEntity.anim.addLayer('UpperBody', data.get('options.blend'), upperBodyMask, data.get('upperBodyLayer.blendType'));
                upperBodyLayer.assignAnimation('Eager', idleEagerTrack);
                upperBodyLayer.assignAnimation('Idle', idleTrack);
                upperBodyLayer.assignAnimation('Dance', danceTrack);

                // respond to changes in the data object made by the control panel
                data.on('*:set', (path: string, value: any) => {
                    if (path === 'fullBodyLayer.state') {
                        modelEntity.anim.baseLayer.transition(value, 0.4);
                    }
                    if (path === 'upperBodyLayer.state') {
                        upperBodyLayer.transition(value, 0.4);
                    }
                    if (path === 'fullBodyLayer.blendType') {
                        modelEntity.anim.baseLayer.blendType = value;
                    }
                    if (path === 'upperBodyLayer.blendType') {
                        upperBodyLayer.blendType = value;
                    }
                    if (path === 'upperBodyLayer.useMask') {
                        upperBodyLayer.mask = value ? {
                            'RootNode/AVATAR/C_spine0001_bind_JNT/C_spine0002_bind_JNT': {
                                children: true
                            }
                        } : null;
                    }
                    if (path === 'options.blend') {
                        modelEntity.anim.baseLayer.weight = 1.0 - value;
                        upperBodyLayer.weight = value;
                    }
                });

                const drawSkeleton = (entity: pc.Entity, color: pc.Color) => {
                    entity.children.forEach((c: pc.Entity) => {
                        const target = modelEntity.anim._targets[entity.path + '/graph/localPosition'];
                        if (target) {
                            app.drawLine(entity.getPosition(), c.getPosition(), new pc.Color(target.getWeight(0), 0, target.getWeight(1), 1), false);
                        }
                        drawSkeleton(c, color);
                    });
                };

                app.on('update', () => {
                    if (data.get('options.skeleton')) {
                        drawSkeleton(modelEntity, new pc.Color(1, 0, 0, modelEntity.anim.baseLayer.weight * 0.5));
                    }
                });

                app.start();
            });
        });
    }
}
export default LayerMasksExample;
