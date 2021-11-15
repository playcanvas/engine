import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';
// @ts-ignore: library file import
import Panel from '@playcanvas/pcui/Panel/component';
// @ts-ignore: library file import
import SliderInput from '@playcanvas/pcui/SliderInput/component';
// @ts-ignore: library file import
import BindingTwoWay from '@playcanvas/pcui/BindingTwoWay';
// @ts-ignore: library file import
import LabelGroup from '@playcanvas/pcui/LabelGroup/component';
// @ts-ignore: library file import
import { Observer } from '@playcanvas/observer';

class AreaLightsExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Clustered Area Lights';

    load() {
        return <>
            <AssetLoader name='bloom' type='script' url='static/scripts/posteffects/posteffect-bloom.js' />
            <AssetLoader name='script' type='script' url='static/scripts/camera/orbit-camera.js' />
            <AssetLoader name='color' type='texture' url='static/assets/textures/seaside-rocks01-color.jpg' />
            <AssetLoader name='normal' type='texture' url='static/assets/textures/seaside-rocks01-normal.jpg' />
            <AssetLoader name='gloss' type='texture' url='static/assets/textures/seaside-rocks01-gloss.jpg' />
            <AssetLoader name='luts' type='binary' url='static/assets/binary/area-light-luts.bin' />
        </>;
    }

    controls(data: Observer) {
        return <>
            <Panel headerText='Material'>
                <LabelGroup text='Shininess'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.material.shininess' }} min={0} max={100} precision={0}/>
                </LabelGroup>
                <LabelGroup text='Metalness'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.material.metalness' }} min={0} max={1} precision={2}/>
                </LabelGroup>
            </Panel>
        </>;
    }

    example(canvas: HTMLCanvasElement, assets: any, data:any): void {

        data.set('settings', {
            material: {
                shininess: 80,
                metalness: 0.7
            }
        });

        // Create the app and start the update loop
        const app = new pc.Application(canvas, {
            mouse: new pc.Mouse(document.body),
            touch: new pc.TouchDevice(document.body)
        });

        // set up some general scene rendering properties
        app.scene.gammaCorrection = pc.GAMMA_SRGB;
        app.scene.toneMapping = pc.TONEMAP_ACES;

        // enabled clustered lighting. This is a temporary API and will change in the future
        // @ts-ignore engine-tsd
        pc.LayerComposition.clusteredLightingEnabled = true;

        // adjust default clusterered lighting parameters to handle many lights:
        // 1) subdivide space with lights into this many cells:
        // @ts-ignore engine-tsd
        app.scene.layers.clusteredLightingCells = new pc.Vec3(30, 2, 30);

        // 2) and allow this many lights per cell:
        // @ts-ignore engine-tsd
        app.scene.layers.clusteredLightingMaxLights = 20;

        // @ts-ignore engine-tsd
        app.scene.layers.clusteredLightingAreaLightsEnabled = true;


        // pure black material - used on back side of light objects
        const blackMaterial = new pc.StandardMaterial();
        blackMaterial.diffuse = new pc.Color(0, 0, 0);
        blackMaterial.useLighting = false;
        blackMaterial.update();

        // ground material
        const groundMaterial = new pc.StandardMaterial();
        groundMaterial.diffuse = pc.Color.GRAY;
        groundMaterial.shininess = 80;
        groundMaterial.metalness = 0.7;
        groundMaterial.useMetalness = true;

        // helper function to create a primitive with shape type, position, scale, color
        function createPrimitive(primitiveType: string, position: pc.Vec3, scale: pc.Vec3, assetManifest: any) {

            if (assetManifest) {
                groundMaterial.diffuseMap = assetManifest.color.resource;
                groundMaterial.normalMap = assetManifest.normal.resource;
                groundMaterial.glossMap = assetManifest.gloss.resource;

                groundMaterial.diffuseMapTiling.set(17, 17);
                groundMaterial.normalMapTiling.set(17, 17);
                groundMaterial.glossMapTiling.set(17, 17);
            }

            groundMaterial.update();

            // create primitive
            const primitive = new pc.Entity();
            primitive.addComponent('render', {
                type: primitiveType,
                material: groundMaterial
            });

            // set position and scale and add it to scene
            primitive.setLocalPosition(position);
            primitive.setLocalScale(scale);
            app.root.addChild(primitive);

            return primitive;
        }

        // helper function to create area light including its visual representation in the world
        function createAreaLight(type: string, shape: number, position: pc.Vec3, scale: pc.Vec3, color: pc.Color, intensity: number, range: number) {

            const light = new pc.Entity();
            light.addComponent("light", {
                type: type,
                shape: shape,
                color: color,
                intensity: intensity,
                falloffMode: pc.LIGHTFALLOFF_INVERSESQUARED,
                range: range,
                innerConeAngle: 88,
                outerConeAngle: 89
            });

            light.setLocalScale(scale);
            light.setLocalPosition(position);
            if (type === "spot") {
                light.rotate(-90, 0, 0);
            }
            app.root.addChild(light);

            // emissive material that is the light source color
            const brightMaterial = new pc.StandardMaterial();
            brightMaterial.emissive = new pc.Color(color.r * 0.8, color.g * 0.8, color.b * 0.8);
            brightMaterial.useLighting = false;
            brightMaterial.update();

            // primitive shape that matches light source shape
            const lightPrimitive = (shape === pc.LIGHTSHAPE_SPHERE) ? "sphere" : (shape === pc.LIGHTSHAPE_DISK) ? "cylinder" : "box";

            // primitive scale - flatten it to disk / rectangle
            const primitiveScale = new pc.Vec3(1, shape !== pc.LIGHTSHAPE_SPHERE ? 0.001 : 1, 1);

            // bright primitive representing the area light source
            const brightShape = new pc.Entity();
            brightShape.addComponent("render", {
                type: lightPrimitive,
                material: brightMaterial
            });
            brightShape.setLocalScale(primitiveScale);
            light.addChild(brightShape);

            // black primitive representing the back of the light source which is not emitting light
            if (type === "spot") {

                const blackShape = new pc.Entity();
                blackShape.addComponent("render", {
                    type: lightPrimitive,
                    material: blackMaterial
                });
                blackShape.setLocalPosition(0, 0.004, 0);
                blackShape.setLocalEulerAngles(-180, 0, 0);
                blackShape.setLocalScale(primitiveScale);
                light.addChild(blackShape);
            }

            return light;
        }

        app.start();

        // set the loaded area light LUT data
        app.setAreaLightLuts(assets.luts);

        // set up some general scene rendering properties
        app.scene.gammaCorrection = pc.GAMMA_SRGB;
        app.scene.toneMapping = pc.TONEMAP_ACES;

        // create ground plane
        const ground = createPrimitive("plane", new pc.Vec3(0, 0, 0), new pc.Vec3(45, 1, 45), assets);

        // Create the camera, which renders entities
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.1, 0.1, 0.1),
            fov: 60,
            farClip: 1000
        });
        camera.setLocalPosition(3, 3, 12);

        // add orbit camera script with a mouse and a touch support
        camera.addComponent("script");
        camera.script.create("orbitCamera", {
            attributes: {
                inertiaFactor: 0.2,
                focusEntity: ground,
                distanceMax: 24
            }
        });
        camera.script.create("orbitCameraInputMouse");
        camera.script.create("orbitCameraInputTouch");
        app.root.addChild(camera);

        // add bloom postprocessing
        camera.addComponent("script");
        camera.script.create("bloom", {
            attributes: {
                bloomIntensity: 1.5,
                bloomThreshold: 0.6,
                blurAmount: 6
            }
        });

        // generate a grid of area lights of sphere, disk and rect shapes
        for (let x = -20; x <= 20; x += 5) {
            for (let y = -20; y <= 20; y += 5) {
                const pos = new pc.Vec3(x, 0.6, y);
                const color = new pc.Color(0.3 + Math.random() * 0.7, 0.3 + Math.random() * 0.7, 0.3 + Math.random() * 0.7);
                const rand = Math.random();
                if (rand < 0.3) {
                    createAreaLight("omni", pc.LIGHTSHAPE_SPHERE, pos, new pc.Vec3(1.5, 1.5, 1.5), color, 2, 6);
                } else if (rand < 0.6) {
                    createAreaLight("spot", pc.LIGHTSHAPE_DISK, pos, new pc.Vec3(1.5, 1.5, 1.5), color, 2.5, 5);
                } else {
                    createAreaLight("spot", pc.LIGHTSHAPE_RECT, pos, new pc.Vec3(2, 1, 1), color, 2.5, 5);
                }
            }
        }

        // handle HUD changes - update properties on the material
        data.on('*:set', (path: string, value: any) => {
            const pathArray = path.split('.');
            if (pathArray[2] === "shininess") groundMaterial.shininess = value;
            if (pathArray[2] === "metalness") groundMaterial.metalness = value;
            groundMaterial.update();
        });
    }
}

export default AreaLightsExample;
