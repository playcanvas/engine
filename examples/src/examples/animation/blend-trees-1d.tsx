import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';
// @ts-ignore: library file import
import { SliderInput, LabelGroup } from '@playcanvas/pcui/pcui-react';
// @ts-ignore: library file import
import { BindingTwoWay, Observer } from '@playcanvas/pcui/pcui-binding';

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

class BlendTrees1DExample extends Example {
    static CATEGORY = 'Animation';
    static NAME = 'Blend Trees 1D';

    load() {
        return <>
            <AssetLoader name='model' type='container' url='static/assets/models/bitmoji.glb' />
            <AssetLoader name='idleAnim' type='container' url='static/assets/animations/bitmoji/idle.glb' />
            <AssetLoader name='danceAnim' type='container' url='static/assets/animations/bitmoji/dance.glb' />
            <AssetLoader name='animStateGraph' type='json' data={animStateGraphData} />
        </>;
    }

    // @ts-ignore: override class function
    controls(data: Observer) {
        return <>
            <LabelGroup text='blend'>
                <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'blend' }}/>
            </LabelGroup>
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { model: pc.Asset, idleAnim: pc.Asset, danceAnim: pc.Asset, animStateGraph: pc.Asset }, data: any): void {

        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body),
            elementInput: new pc.ElementInput(canvas)
        });
        // Create an Entity with a camera component
        const cameraEntity = new pc.Entity();
        cameraEntity.addComponent("camera", {
            clearColor: new pc.Color(0.1, 0.15, 0.2)
        });
        cameraEntity.translateLocal(0.0, 0.75, 5.0);
        app.root.addChild(cameraEntity);

        // Create an entity with a light component
        app.scene.ambientLight = new pc.Color(0.5, 0.5, 0.5);
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "directional"
        });
        light.setLocalEulerAngles(45, 30, 0);
        app.root.addChild(light);

        // create an entity from the loaded model using the render component
        const modelEntity = assets.model.resource.instantiateRenderEntity({
            castShadows: true
        });

        // add an anim component to the entity
        modelEntity.addComponent('anim', {
            activate: true
        });

        // load the state graph into the anim component
        modelEntity.anim.loadStateGraph(assets.animStateGraph.data);

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
