import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';
// @ts-ignore: library file import
import SliderInput from '@playcanvas/pcui/SliderInput/component';
// @ts-ignore: library file import
import LabelGroup from '@playcanvas/pcui/LabelGroup/component';
// @ts-ignore: library file import
import BindingTwoWay from '@playcanvas/pcui/BindingTwoWay';
// @ts-ignore: library file import
import { Observer } from '@playcanvas/observer';

class BlendTrees1DExample extends Example {
    static CATEGORY = 'Animation';
    static NAME = 'Blend Trees 1D';

    load() {
        return <>
            <AssetLoader name='model' type='container' url='static/assets/models/bitmoji.glb' />
            <AssetLoader name='idleAnim' type='container' url='static/assets/animations/bitmoji/idle.glb' />
            <AssetLoader name='danceAnim' type='container' url='static/assets/animations/bitmoji/win-dance.glb' />
            <AssetLoader name='helipad.dds' type='cubemap' url='static/assets/cubemaps/helipad.dds' data={{ type: pc.TEXTURETYPE_RGBM }}/>
            <AssetLoader name='bloom' type='script' url='static/scripts/posteffects/posteffect-bloom.js' />
        </>;
    }

    controls(data: Observer) {
        return <>
            <LabelGroup text='blend'>
                <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'blend' }}/>
            </LabelGroup>
        </>;
    }

    example(canvas: HTMLCanvasElement, assets: any, data: any): void {

        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body),
            elementInput: new pc.ElementInput(canvas)
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

        // add an anim component to the entity
        modelEntity.addComponent('anim', {
            activate: true
        });

        // create an anim state graph
        const animStateGraphData = {
            "layers": [
                {
                    "name": "characterState",
                    "states": [
                        {
                            "name": "START"
                        },
                        {
                            "name": "Movement",
                            "speed": 1.0,
                            "loop": true,
                            "blendTree": {
                                "type": "1D",
                                "parameter": "blend",
                                "children": [
                                    {
                                        "name": "Idle",
                                        "point": 0.0
                                    },
                                    {
                                        "name": "Dance",
                                        "point": 1.0,
                                        "speed": 0.85
                                    }
                                ]
                            }
                        }
                    ],
                    "transitions": [
                        {
                            "from": "START",
                            "to": "Movement"
                        }
                    ]
                }
            ],
            "parameters": {
                "blend": {
                    "name": "blend",
                    "type": "FLOAT",
                    "value": 0
                }
            }
        };

        // load the state graph into the anim component
        modelEntity.anim.loadStateGraph(animStateGraphData);

        // load the state graph asset resource into the anim component
        const characterStateLayer = modelEntity.anim.baseLayer;
        characterStateLayer.assignAnimation('Movement.Idle', assets.idleAnim.resource.animations[0].resource);
        characterStateLayer.assignAnimation('Movement.Dance', assets.danceAnim.resource.animations[0].resource);

        app.root.addChild(modelEntity);

        app.start();

        data.on('blend:set', (blend: number) => {
            modelEntity.anim.setFloat('blend', blend);
        });
    }
}

export default BlendTrees1DExample;
