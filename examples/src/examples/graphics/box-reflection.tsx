import React from 'react';
import * as pc from '../../../../';
import { AssetLoader } from '../../app/helpers/loader';

// @ts-ignore: library file import
import Panel from '@playcanvas/pcui/Panel/component';
// @ts-ignore: library file import
import SliderInput from '@playcanvas/pcui/SliderInput/component';
// @ts-ignore: library file import
import LabelGroup from '@playcanvas/pcui/LabelGroup/component';
// @ts-ignore: library file import
import BindingTwoWay from '@playcanvas/pcui/BindingTwoWay';
// @ts-ignore: library file import
import SelectInput from '@playcanvas/pcui/SelectInput/component';
// @ts-ignore: library file import
import { Observer } from '@playcanvas/observer';

class BoxReflectionExample {
    static CATEGORY = 'Graphics';
    static NAME = 'Box Reflection';

    load() {
        return <>
            <AssetLoader name='script' type='script' url='/static/scripts/camera/orbit-camera.js' />
            <AssetLoader name='script' type='script' url='/static/scripts/utils/cubemap-renderer.js' />
            <AssetLoader name='normal' type='texture' url='/static/assets/textures/normal-map.png' />
        </>;
    }

    controls(data: Observer) {
        return <>
            <Panel headerText='Settings'>
                {<LabelGroup text='Update'>
                    <SelectInput binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.updateFrequency' }} type="number" options={[
                        { v: 0, t: 'Once' },
                        { v: 1, t: 'Every frame' },
                        { v: 10, t: 'Every 10 frames' },
                        { v: 30, t: 'Every 30 frames' }
                    ]} />
                </LabelGroup>}
                <LabelGroup text='Shininess'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.shininess' }} min={0} max={100} precision={0}/>
                </LabelGroup>
                <LabelGroup text='Metalness'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.metalness' }} min={0} max={1} precision={2}/>
                </LabelGroup>
                <LabelGroup text='Bumpiness'>
                    <SliderInput binding={new BindingTwoWay()} link={{ observer: data, path: 'settings.bumpiness' }} min={0} max={1} precision={2}/>
                </LabelGroup>
            </Panel>
        </>;
    }

    example(canvas: HTMLCanvasElement, assets: any, data: any): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        data.set('settings', {
            updateFrequency: 10,
            shininess: 90,
            metalness: 0.7,
            bumpiness: 0.2
        });

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        // create a layer for object that do not render into reflection cubemap
        const excludedLayer = new pc.Layer({ name: "Excluded" });
        app.scene.layers.push(excludedLayer);

        // get world layer
        const worldLayer = app.scene.layers.getLayerByName("World");

        // create an envAtlas texture, which will hold a prefiltering lighting generated from the cubemap.
        // This represents a reflection prefiltered for different levels of roughness
        const envAtlas = new pc.Texture(app.graphicsDevice, {
            width: 512,
            height: 512,
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
            type: pc.TEXTURETYPE_RGBM,
            projection: pc.TEXTUREPROJECTION_EQUIRECT,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE,
            mipmaps: false
        });

        // material for the walls
        const roomMaterial = new pc.StandardMaterial();
        roomMaterial.useMetalness = true;
        roomMaterial.diffuse = pc.Color.WHITE;
        roomMaterial.normalMap = assets.normal.resource;
        roomMaterial.normalMapTiling.set(5, 5);
        roomMaterial.bumpiness = 0.1;
        roomMaterial.shininess = 90;
        // @ts-ignore
        roomMaterial.envAtlas = envAtlas; // use reflection from env atlas
        roomMaterial.metalness = 0.5;

        // the material uses box projected cubemap for reflections. Set its bounding box the the size of the room
        // so that the reflections line up
        roomMaterial.cubeMapProjection = pc.CUBEPROJ_BOX;
        roomMaterial.cubeMapProjectionBox = new pc.BoundingBox(new pc.Vec3(0, 200, 0), new pc.Vec3(400, 200, 400));
        roomMaterial.update();

        // material for the magenta emissive beams
        const emissiveMaterial = new pc.StandardMaterial();
        emissiveMaterial.emissive = pc.Color.MAGENTA;
        emissiveMaterial.diffuse = pc.Color.BLACK;
        emissiveMaterial.update();

        // material for the white sphere representing an omni light
        const lightMaterial = new pc.StandardMaterial();
        lightMaterial.emissive = pc.Color.WHITE;
        lightMaterial.diffuse = pc.Color.BLACK;
        lightMaterial.update();

        // material for the reflective sphere in the center
        const sphereMaterial = new pc.StandardMaterial();
        sphereMaterial.useMetalness = true;
        sphereMaterial.diffuse = pc.Color.WHITE;
        sphereMaterial.normalMap = assets.normal.resource;
        sphereMaterial.normalMapTiling.set(5, 5);
        sphereMaterial.bumpiness = 0.7;
        sphereMaterial.shininess = 90;
        sphereMaterial.metalness = 0.6;
        // @ts-ignore
        sphereMaterial.envAtlas = envAtlas; // use reflection from env atlas
        sphereMaterial.update();

        // set up video playback into a texture
        const videoTexture = new pc.Texture(app.graphicsDevice, {
            format: pc.PIXELFORMAT_R5_G6_B5,
            mipmaps: false,
            minFilter: pc.FILTER_LINEAR,
            magFilter: pc.FILTER_LINEAR,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE
        });

        // create a HTML element with the video
        const video: HTMLVideoElement = document.createElement('video');
        video.id = 'vid';
        video.loop = true;
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;
        video.crossOrigin = "anonymous";
        video.setAttribute('style', 'display: block; width: 1px; height: 1px; position: absolute; opacity: 0; z-index: -1000; top: 0px; pointer-events: none');
        video.src = '/static/assets/video/SampleVideo_1280x720_1mb.mp4';
        document.body.append(video);
        video.addEventListener('canplaythrough', function () {
            videoTexture.setSource(video);
        });

        // materials used on the TV screen to display the video texture
        const screenMaterial = new pc.StandardMaterial();
        screenMaterial.useLighting = false;
        screenMaterial.emissiveMap = videoTexture;
        screenMaterial.update();

        // helper function to create a 3d primitive including its material
        function createPrimitive(primitiveType: string, position: pc.Vec3, scale: pc.Vec3, material: pc.Material) {

            // create the primitive using the material
            const primitive = new pc.Entity();
            primitive.addComponent('render', {
                type: primitiveType,
                material: material,
                layers: [worldLayer.id, excludedLayer.id]
            });

            // set position and scale and add it to scene
            primitive.setLocalPosition(position);
            primitive.setLocalScale(scale);
            app.root.addChild(primitive);
        }

        // create the ground plane from the boxes
        createPrimitive("box", new pc.Vec3(0, 0, 0), new pc.Vec3(800, 2, 800), roomMaterial);
        createPrimitive("box", new pc.Vec3(0, 400, 0), new pc.Vec3(800, 2, 800), roomMaterial);

        // walls
        createPrimitive("box", new pc.Vec3(400, 200, 0), new pc.Vec3(2, 400, 800), roomMaterial);
        createPrimitive("box", new pc.Vec3(-400, 200, 0), new pc.Vec3(2, 400, 800), roomMaterial);
        createPrimitive("box", new pc.Vec3(0, 200, -400), new pc.Vec3(800, 400, 0), roomMaterial);
        createPrimitive("box", new pc.Vec3(0, 200, 400), new pc.Vec3(800, 400, 0), roomMaterial);

        // emissive pillars
        createPrimitive("box", new pc.Vec3(400, 200, -50), new pc.Vec3(20, 400, 20), emissiveMaterial);
        createPrimitive("box", new pc.Vec3(400, 200, 50), new pc.Vec3(20, 400, 20), emissiveMaterial);
        createPrimitive("box", new pc.Vec3(-400, 200, 50), new pc.Vec3(20, 400, 20), emissiveMaterial);
        createPrimitive("box", new pc.Vec3(-400, 200, -50), new pc.Vec3(20, 400, 20), emissiveMaterial);
        createPrimitive("box", new pc.Vec3(0, 400, 50), new pc.Vec3(800, 20, 20), emissiveMaterial);
        createPrimitive("box", new pc.Vec3(0, 400, -50), new pc.Vec3(800, 20, 20), emissiveMaterial);

        // screen
        createPrimitive("box", new pc.Vec3(0, 200, 400), new pc.Vec3(500, 250, 5), screenMaterial);

        // sphere
        createPrimitive("sphere", new pc.Vec3(0, 150, 0), new pc.Vec3(150, 150, 150), sphereMaterial);

        // create an omni light white orbits the room to avoid it being completely dark
        const lightOmni = new pc.Entity();
        lightOmni.addComponent("light", {
            type: "omni",
            layers: [excludedLayer.id], // add it to excluded layer, we don't want the light captured in the reflection
            castShadows: false,
            color: pc.Color.WHITE,
            intensity: 0.2,
            range: 1000
        });

        // add a white sphere to light so that we can see where it is. This sphere is excluded from the reflections.
        lightOmni.addComponent("render", {
            type: "sphere",
            layers: [excludedLayer.id],
            material: lightMaterial
        });
        lightOmni.setLocalScale(20, 20, 20);
        app.root.addChild(lightOmni);

        // create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            fov: 100,
            layers: [worldLayer.id, excludedLayer.id],
            farClip: 1500
        });
        camera.setLocalPosition(270, 90, -260);

        // add orbit camera script with a mouse and a touch support
        camera.addComponent("script");
        camera.script.create("orbitCamera", {
            attributes: {
                inertiaFactor: 0.2,
                distanceMax: 390,
                frameOnStart: false
            }
        });
        camera.script.create("orbitCameraInputMouse");
        camera.script.create("orbitCameraInputTouch");
        app.root.addChild(camera);

        // create a probe object with cubemapRenderer script which takes care of rendering dynamic cubemap
        const probe = new pc.Entity();
        probe.addComponent('script');

        // add camera component to the probe - this defines camera properties for cubemap rendering
        probe.addComponent('camera', {

            // optimization - no need to clear as all pixels get overwritten
            clearColorBuffer: false,

            // priority - render before world camera
            priority: -1,

            // only render meshes on the worldLayer (and not excluded layer)
            layers: [worldLayer.id],

            // disable as this is not a camera that renders cube map but only a container for properties for cube map rendering
            enabled: false,

            nearClip: 1,
            farClip: 500
        });

        // Add a cubemap renderer script, which renders to a cubemap of size 128 with mipmaps, which is directly useable
        // as a lighting source for envAtlas generation
        // Position it in the center of the room.
        probe.script.create('cubemapRenderer', {
            attributes: {
                resolution: 128,
                mipmaps: true,
                depth: true
            }
        });
        probe.setPosition(0, 200, 0);
        app.root.addChild(probe);

        // handle onCubemapPostRender event fired by the cubemapRenderer when all faces of the cubemap are done rendering
        probe.on('onCubemapPostRender', () => {

            // prefilter just rendered cubemap into envAtlas, so that it can be used for reflection during the rest of the frame
            // @ts-ignore
            pc.EnvLighting.generateAtlas(probe.script.cubemapRenderer.cubeMap, {
                target: envAtlas
            });
        });

        // Set an update function on the app's update event
        let time = 0;
        let updateProbeCount = 1;
        let updateVideo = true;
        app.on("update", function (dt: number) {
            time += dt * 0.3;

            // Update the video data to the texture every other frame
            if (updateVideo) {
                videoTexture.upload();
            }
            updateVideo = !updateVideo;

            // move the light around
            lightOmni.setLocalPosition(300 * Math.sin(time), 300, 300 * Math.cos(time));

            // update the reflection probe as needed
            const updateFrequency = data.get('settings.updateFrequency');
            updateProbeCount--;
            if (updateFrequency === 0)
                updateProbeCount = 1;

            if (updateProbeCount <= 0) {
                // enable probe rendering
                probe.enabled = true;
                updateProbeCount = updateFrequency;
            } else {
                probe.enabled = false;
            }

            // update material properties based on settings
            const shininess = data.get('settings.shininess');
            const metalness = data.get('settings.metalness');
            const bumpiness = data.get('settings.bumpiness');

            roomMaterial.shininess = shininess;
            roomMaterial.metalness = metalness;
            roomMaterial.bumpiness = bumpiness;
            roomMaterial.update();

            sphereMaterial.shininess = shininess;
            sphereMaterial.metalness = metalness;
            sphereMaterial.bumpiness = bumpiness;
            sphereMaterial.update();
        });
    }
}

export default BoxReflectionExample;
