import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';
// @ts-ignore: library file import
import { Button } from '@playcanvas/pcui/pcui-react';

const animClipStaticLightData = {
    "name": "staticLight",
    "duration": 1.0,
    // curve keyframe inputs
    "inputs": [
        [
            0.0
        ]
    ],
    // curve keyframe outputs
    "outputs": [
        // a single RGBA color keyframe value of a green light
        {
            "components": 4,
            "data": [
                0.0, 1.0, 0.0, 1.0
            ]
        },
        // a single quaternion keyframe value with no rotation
        {
            "components": 4,
            "data": [
                0.0, 0.0, 0.0, 0.0
            ]
        }
    ],
    // the curves contained in the clip, each with the path to the property they animation, the index of
    // their input and output keyframes and the method of interpolation to be used
    "curves": [
        {
            "path": { entityPath: ["lights", "spotLight1"], component: "light", propertyPath: ["color"] },
            "inputIndex": 0,
            "outputIndex": 0,
            "interpolation": 1
        },
        {
            "path": { entityPath: ["lights", "spotLight2"], component: "light", propertyPath: ["color"] },
            "inputIndex": 0,
            "outputIndex": 0,
            "interpolation": 1
        },
        {
            "path": { entityPath: ["lights", "spotLight1"], component: "entity", propertyPath: ["localEulerAngles"] },
            "inputIndex": 0,
            "outputIndex": 1,
            "interpolation": 1
        },
        {
            "path": { entityPath: ["lights", "spotLight2"], component: "entity", propertyPath: ["localEulerAngles"] },
            "inputIndex": 0,
            "outputIndex": 1,
            "interpolation": 1
        }
    ]
};

// create the animation data for two flashing spot lights
const animClipFlashingLightData = {
    "name": "flashingLight",
    "duration": 2.0,
    // curve keyframe inputs
    "inputs": [
        [
            0.0, 0.5, 1.0, 1.5, 2.0
        ],
        [
            0, 1, 2
        ]
    ],
    // curve keyframe outputs
    "outputs": [
        //  keyframe outputs for a flashing red RGBA color
        {
            "components": 4,
            "data": [
                1.0, 0.0, 0.0, 1.0,
                0.4, 0.0, 0.0, 1.0,
                1.0, 0.0, 0.0, 1.0,
                0.4, 0.0, 0.0, 1.0,
                1.0, 0.0, 0.0, 1.0
            ]
        },
        //  keyframe outputs for a quaterion rotation
        {
            "components": 4,
            "data": [
                4.0, 0.0, 0.0, 0.0,
                4.0, 180.0, 0.0, 0.0,
                4.0, 0.0, 0.0, 0.0
            ]
        },
        //  keyframe outputs for a quaterion rotation
        {
            "components": 4,
            "data": [
                -4.0, 0.0, 0.0, 0.0,
                -4.0, 180.0, 0.0, 0.0,
                -4.0, 0.0, 0.0, 0.0
            ]
        }
    ],
    // the curves contained in the clip, each with the path to the property they animation, the index of
    // their input and output keyframes and the method of interpolation to be used
    "curves": [
        {
            "path": { entityPath: ["lights", "spotLight1"], component: "light", propertyPath: ["color"] },
            "inputIndex": 0,
            "outputIndex": 0,
            "interpolation": 1
        },
        {
            "path": { entityPath: ["lights", "spotLight2"], component: "light", propertyPath: ["color"] },
            "inputIndex": 0,
            "outputIndex": 0,
            "interpolation": 1
        },
        {
            "path": { entityPath: ["lights", "spotLight1"], component: "entity", propertyPath: ["localEulerAngles"] },
            "inputIndex": 1,
            "outputIndex": 1,
            "interpolation": 1
        },
        {
            "path": { entityPath: ["lights", "spotLight2"], component: "entity", propertyPath: ["localEulerAngles"] },
            "inputIndex": 1,
            "outputIndex": 2,
            "interpolation": 1
        }
    ]
};

// create an anim state graph
const animStateGraphData = {
    "layers": [
        {
            "name": "Base",
            "states": [
                {
                    "name": "START"
                },
                {
                    "name": "Static",
                    "speed": 1.0
                },
                {
                    "name": "Flash",
                    "speed": 1.0
                },
                {
                    "name": "END"
                }
            ],
            "transitions": [
                {
                    "from": "START",
                    "to": "Static"
                },
                {
                    "from": "Static",
                    "to": "Flash",
                    "time": 1.5,
                    "interruptionSource": "NEXT_STATE",
                    "conditions": [
                        {
                            "parameterName": "flash",
                            "predicate": "EQUAL_TO",
                            "value": true
                        }
                    ]
                },
                {
                    "from": "Flash",
                    "to": "Static",
                    "time": 1.5,
                    "interruptionSource": "NEXT_STATE",
                    "conditions": [
                        {
                            "parameterName": "flash",
                            "predicate": "EQUAL_TO",
                            "value": false
                        }
                    ]
                }
            ]
        }
    ],
    "parameters": {
        "flash": {
            "name": "flash",
            "type": "BOOLEAN",
            "value": false
        }
    }
};

class ComponentPropertiesExample extends Example {
    static CATEGORY = 'Animation';
    static NAME = 'Component Properties';

    load() {
        return <>
            <AssetLoader name='playcanvasGreyTexture' type='texture' url='static/assets/textures/playcanvas-grey.png' />
            <AssetLoader name='staticLightClip' type='json' data={animClipStaticLightData} />
            <AssetLoader name='flashingLightClip' type='json' data={animClipFlashingLightData} />
            <AssetLoader name='animStateGraph' type='json' data={animStateGraphData} />
        </>;
    }

    // @ts-ignore: abstract class function
    controls(data: any) {
        return <>
            <Button text='Flash' onClick={() => {
                data.set('flash', !data.get('flash'));
            }}/>
        </>;
    }


    // @ts-ignore: abstract class function
    example(canvas: HTMLCanvasElement, assets: { playcanvasGreyTexture: pc.Asset, staticLightClip: pc.Asset, flashingLightClip: pc.Asset, animStateGraph: pc.Asset }, data: any): void {

        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body),
            elementInput: new pc.ElementInput(canvas)
        });

        // create the animation data for two static spot lights

        // @ts-ignore
        const animClipHandler = new pc.AnimClipHandler();
        const animClipStaticLight = animClipHandler.open(undefined, assets.staticLightClip.data);
        const animClipFlashingLight = animClipHandler.open(undefined, assets.flashingLightClip.data);

        // Create an Entity with a camera component
        const cameraEntity = new pc.Entity();
        cameraEntity.name = 'camera';
        cameraEntity.addComponent("camera", {
            clearColor: new pc.Color(0, 0, 0.0)
        });
        cameraEntity.translateLocal(7, 10, 7);
        cameraEntity.lookAt(0, 0, 0);

        const boxEntity = new pc.Entity();
        boxEntity.addComponent("render", {
            type: 'box'
        });
        boxEntity.name = 'model';
        boxEntity.setPosition(0, 0.25, 0);
        boxEntity.setLocalScale(0.5, 0.5, 0.5);
        const material = new pc.StandardMaterial();
        material.diffuseMap = assets.playcanvasGreyTexture.resource;
        material.update();
        boxEntity.render.meshInstances[0].material = material;

        const planeEntity = new pc.Entity();
        planeEntity.name = 'plane';
        planeEntity.addComponent("render", {
            type: "plane"
        });
        planeEntity.setLocalScale(15, 1, 15);
        planeEntity.setPosition(0, 0, 0);

        // Create the animatible lights
        const lightsEntity = new pc.Entity();
        lightsEntity.name = 'lights';

        const light1 = new pc.Entity();
        light1.name = 'spotLight1';
        light1.addComponent("light", {
            type: "spot",
            color: new pc.Color(0.0, 0.0, 0.0, 1.0),
            intensity: 1,
            range: 15,
            innerConeAngle: 5,
            outerConeAngle: 10
        });
        light1.setPosition(0, 10, 0);

        const light2 = new pc.Entity();
        light2.name = 'spotLight2';
        light2.addComponent("light", {
            type: "spot",
            color: new pc.Color(0.0, 0.0, 0.0, 1.0),
            intensity: 1,
            range: 15,
            innerConeAngle: 5,
            outerConeAngle: 10
        });
        light2.setPosition(0, 10, 0);

        // Add Entities into the scene hierarchy
        app.root.addChild(cameraEntity);
        lightsEntity.addChild(light1);
        lightsEntity.addChild(light2);
        app.root.addChild(lightsEntity);
        app.root.addChild(boxEntity);
        app.root.addChild(planeEntity);

        // add the anim component to the lights entity
        lightsEntity.addComponent("anim", {
            speed: 1.0,
            activate: true
        });

        // load the state graph into the anim component
        lightsEntity.anim.loadStateGraph(assets.animStateGraph.data);

        // assign animation clip asset resources to the appropriate states
        lightsEntity.anim.assignAnimation('Static', animClipStaticLight);
        lightsEntity.anim.assignAnimation('Flash', animClipFlashingLight);

        app.start();

        data.on('flash:set', (value: boolean) => {
            lightsEntity.anim.setBoolean('flash', value);
        });
    }
}

export default ComponentPropertiesExample;
