import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

// @ts-ignore: library file import
import Panel from '@playcanvas/pcui/Panel/component';
// @ts-ignore: library file import
import SelectInput from '@playcanvas/pcui/SelectInput/component';
// @ts-ignore: library file import
import LabelGroup from '@playcanvas/pcui/LabelGroup/component';
// @ts-ignore: library file import
import BooleanInput from '@playcanvas/pcui/BooleanInput/component';
// @ts-ignore: library file import
import SliderInput from '@playcanvas/pcui/SliderInput/component';
// @ts-ignore: library file import
import BindingTwoWay from '@playcanvas/pcui/BindingTwoWay';
// @ts-ignore: library file import
import { Observer } from '@playcanvas/observer';

class LayerMasksExample extends Example {
    static CATEGORY = 'Animation';
    static NAME = 'Layer Masks';

    controls(data: Observer) {
        return <>
            <Panel headerText='Full Body Layer'>
                <LabelGroup text='active state'>
                    <SelectInput options={[{ v: 'Idle', t: 'Idle' }, { v: 'Walk', t: 'Walk' }]} binding={new BindingTwoWay()} link={{ observer: data, path: 'fullBodyLayer.state' }}/>
                </LabelGroup>
                <LabelGroup text='blend type'>
                    <SelectInput options={[{ v: pc.ANIM_LAYER_OVERWRITE, t: 'Overwrite' }, { v: pc.ANIM_LAYER_ADDITIVE, t: 'Additive' }]} value={pc.ANIM_LAYER_ADDITIVE} binding={new BindingTwoWay()} link={{ observer: data, path: 'fullBodyLayer.blendType' }}/>
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

    load() {
        return <>
            <AssetLoader name='model' type='container' url='static/assets/models/bitmoji.glb' />
            <AssetLoader name='idleAnim' type='container' url='static/assets/animations/bitmoji/idle.glb' />
            <AssetLoader name='idleEagerAnim' type='container' url='static/assets/animations/bitmoji/idle-eager.glb' />
            <AssetLoader name='walkAnim' type='container' url='static/assets/animations/bitmoji/walk.glb' />
            <AssetLoader name='danceAnim' type='container' url='static/assets/animations/bitmoji/win-dance.glb' />
            <AssetLoader name='helipad.dds' type='cubemap' url='static/assets/cubemaps/helipad.dds' data={{ type: pc.TEXTURETYPE_RGBM }}/>
            <AssetLoader name='bloom' type='script' url='static/scripts/posteffects/posteffect-bloom.js' />
        </>;
    }

    example(canvas: HTMLCanvasElement, assets: any, data: any): void {
        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body)
        });
        app.start();

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
        app.scene.setSkybox(assets['helipad.dds'].resources);

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
            // set a path with the children property as true to include that path and all of it's children in the mask
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
                upperBodyLayer.assignMask(
                    value ? {
                        'RootNode/AVATAR/C_spine0001_bind_JNT/C_spine0002_bind_JNT': {
                            children: true
                        }
                    } : null
                );
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
                    // @ts-ignore defaultLayerWorld doesn't exist in type pc
                    const layer = pc.defaultLayerWorld;
                    app.drawLine(entity.getPosition(), c.getPosition(), new pc.Color(target.getWeight(0), 0, target.getWeight(1), 1), false, layer);
                }
                drawSkeleton(c, color);
            });
        };

        app.on('update', () => {
            if (data.get('options.skeleton')) {
                drawSkeleton(modelEntity, new pc.Color(1, 0, 0, modelEntity.anim.baseLayer.weight * 0.5));
            }
        });

    }
}
export default LayerMasksExample;
