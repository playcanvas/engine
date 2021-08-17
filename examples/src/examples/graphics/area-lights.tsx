import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class AreaLightsExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Area Lights';

    load() {
        return <>
            <AssetLoader name='color' type='texture' url='static/assets/textures/seaside-rocks01-color.jpg' />
            <AssetLoader name='normal' type='texture' url='static/assets/textures/seaside-rocks01-normal.jpg' />
            <AssetLoader name='gloss' type='texture' url='static/assets/textures/seaside-rocks01-gloss.jpg' />
            <AssetLoader name='statue' type='container' url='static/assets/models/statue.glb' />
            <AssetLoader name='luts' type='binary' url='static/assets/binary/area-light-luts.bin' />
            <AssetLoader name='helipad.dds' type='cubemap' url='static/assets/cubemaps/helipad.dds' data={{ type: pc.TEXTURETYPE_RGBM }}/>
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: any): void {

        // Create the app and start the update loop
        const app = new pc.Application(canvas, {});

        // helper function to create a primitive with shape type, position, scale, color
        function createPrimitive(primitiveType: string, position: pc.Vec3, scale: pc.Vec3, color: pc.Color, assetManifest: any) {

            // create material of specified color
            const material = new pc.StandardMaterial();
            material.diffuse = color;
            material.shininess = 80;
            material.useMetalness = true;

            if (assetManifest) {
                material.diffuseMap = assetManifest.color.resource;
                material.normalMap = assetManifest.normal.resource;
                material.glossMap = assetManifest.gloss.resource;
                material.metalness = 0.7;

                material.diffuseMapTiling.set(7, 7);
                material.normalMapTiling.set(7, 7);
                material.glossMapTiling.set(7, 7);
            }

            material.update();

            // create primitive
            const primitive = new pc.Entity();
            primitive.addComponent('render', {
                type: primitiveType,
                material: material
            });

            // set position and scale and add it to scene
            primitive.setLocalPosition(position);
            primitive.setLocalScale(scale);
            app.root.addChild(primitive);

            return primitive;
        }

        // helper function to create area light including its visual representation in the world
        function createAreaLight(type: string, shape: number, position: pc.Vec3, scale: number, color: pc.Color, intensity: number, shadows: boolean, range: number) {
            const lightParent = new pc.Entity();
            lightParent.translate(position);
            app.root.addChild(lightParent);

            const light = new pc.Entity();
            light.addComponent("light", {
                type: type,
                shape: shape,
                color: color,
                intensity: intensity,
                falloffMode: pc.LIGHTFALLOFF_INVERSESQUARED,
                range: range,
                castShadows: shadows,
                innerConeAngle: 80,
                outerConeAngle: 85,
                shadowBias: 0.1,
                normalOffsetBias: 0.1,
                shadowResolution: 2048
            });

            light.setLocalScale(scale, scale, scale);
            lightParent.addChild(light);

            // emissive material that is the light source color
            const brightMaterial = new pc.StandardMaterial();
            brightMaterial.emissive = color;
            brightMaterial.useLighting = false;
            brightMaterial.cull = (shape === pc.LIGHTSHAPE_RECT) ? pc.CULLFACE_NONE : pc.CULLFACE_BACK;
            brightMaterial.update();

            const brightShape = new pc.Entity();
            // primitive shape that matches light source shape
            brightShape.addComponent("render", {
                type: (shape === pc.LIGHTSHAPE_SPHERE) ? "sphere" : (shape === pc.LIGHTSHAPE_DISK) ? "cone" : "plane",
                material: brightMaterial,
                castShadows: (type === "directional") ? false : true
            });
            brightShape.setLocalScale(((type === "directional") ? scale * range : scale), (shape === pc.LIGHTSHAPE_DISK) ? 0.001 : ((type === "directional") ? scale * range : scale), ((type === "directional") ? scale * range : scale));
            lightParent.addChild(brightShape);

            // add black primitive shape if not omni-directional or global directional
            if (type === "spot") {
                // black material
                const blackMaterial = new pc.StandardMaterial();
                blackMaterial.diffuse = new pc.Color(0, 0, 0);
                blackMaterial.useLighting = false;
                blackMaterial.cull = (shape === pc.LIGHTSHAPE_RECT) ? pc.CULLFACE_NONE : pc.CULLFACE_BACK;
                blackMaterial.update();

                const blackShape = new pc.Entity();
                blackShape.addComponent("render", {
                    type: (shape === pc.LIGHTSHAPE_SPHERE) ? "sphere" : (shape === pc.LIGHTSHAPE_DISK) ? "cone" : "plane",
                    material: blackMaterial
                });
                blackShape.setLocalPosition(0, 0.01 / scale, 0);
                blackShape.setLocalEulerAngles(-180, 0, 0);
                brightShape.addChild(blackShape);
            }

            return lightParent;
        }

        const far = 5000.0;

        app.start();

        // set the loaded area light LUT data
        app.setAreaLightLuts(assets.luts);

        // set up some general scene rendering properties
        app.scene.gammaCorrection = pc.GAMMA_SRGB;
        app.scene.toneMapping = pc.TONEMAP_ACES;

        // setup skydome
        app.scene.skyboxMip = 1;            // use top mipmap level of cubemap (full resolution)
        app.scene.skyboxIntensity = 0.4;    // make it darker

        // set skybox - this DDS file was 'prefiltered' in the PlayCanvas Editor and then downloaded.
        app.scene.setSkybox(assets['helipad.dds'].resources);

        // create ground plane
        createPrimitive("plane", new pc.Vec3(0, 0, 0), new pc.Vec3(20, 20, 20), new pc.Color(0.3, 0.3, 0.3), assets);

        // get the instance of the statue and set up with render component
        const statue = assets.statue.resource.instantiateRenderEntity();
        statue.setLocalScale(0.4, 0.4, 0.4);
        app.root.addChild(statue);

        // Create the camera, which renders entities
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.2, 0.2, 0.2),
            fov: 60,
            farClip: 100000
        });
        app.root.addChild(camera);
        camera.setLocalPosition(0, 2.5, 12);
        camera.lookAt(0, 0, 0);

        // Create lights with light source shape
        const light1 = createAreaLight("spot", pc.LIGHTSHAPE_RECT, new pc.Vec3(-3, 4, 0), 4, new pc.Color(1, 1, 1), 2, true, 10);
        const light2 = createAreaLight("omni", pc.LIGHTSHAPE_SPHERE, new pc.Vec3(5, 2, -2), 2, new pc.Color(1, 1, 0), 2, false, 10);
        const light3 = createAreaLight("directional", pc.LIGHTSHAPE_DISK, new pc.Vec3(0, 0, 0), 0.2, new pc.Color(0.7, 0.7, 1), 10, true, far);

        // update things each frame
        let time = 0;
        app.on("update", function (dt) {
            time += dt;

            const factor1 = (Math.sin(time) + 1) * 0.5;
            const factor2 = (Math.sin(time * 0.6) + 1) * 0.5;
            const factor3 = (Math.sin(time * 0.4) + 1) * 0.5;

            if (light1) {
                light1.setLocalEulerAngles(pc.math.lerp(-90, 110, factor1), 0, 90);
                light1.setLocalPosition(-4, pc.math.lerp(2, 4, factor3), pc.math.lerp(-2, 2, factor2));
            }

            if (light2) {
                light2.setLocalPosition(5, pc.math.lerp(1, 3, factor1), pc.math.lerp(-2, 2, factor2));
            }

            if (light3) {
                light3.setLocalEulerAngles(pc.math.lerp(230, 310, factor2), pc.math.lerp(-30, 0, factor3), 90);

                const dir = light3.getWorldTransform().getY();
                const campos = camera.getPosition();

                light3.setPosition(campos.x + dir.x * far, campos.y + dir.y * far, campos.z + dir.z * far);
            }
        });
    }
}

export default AreaLightsExample;
