import React from 'react';
import * as pc from 'playcanvas/build/playcanvas.js';
import { AssetLoader } from '../../app/helpers/loader';
import Example from '../../app/example';

class VideoTextureExample extends Example {
    static CATEGORY = 'Graphics';
    static NAME = 'Video Texture';

    load() {
        return <>
            <AssetLoader name='tv' type='container' url='static/assets/models/tv.glb' />
        </>;
    }

    // @ts-ignore: override class function
    example(canvas: HTMLCanvasElement, assets: { tv: pc.Asset }): void {

        // Create the application and start the update loop
        const app = new pc.Application(canvas, {});
        app.start();

        // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
        app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
        app.setCanvasResolution(pc.RESOLUTION_AUTO);

        app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.2);

        // Create an Entity with a camera component
        const camera = new pc.Entity();
        camera.addComponent("camera", {
            clearColor: new pc.Color(0.4, 0.45, 0.5)
        });
        camera.translate(0, 0, 15);

        // Create an Entity with a omni light
        const light = new pc.Entity();
        light.addComponent("light", {
            type: "omni",
            color: new pc.Color(1, 1, 1),
            range: 30
        });
        light.translate(5, 5, 10);

        app.root.addChild(camera);
        app.root.addChild(light);

        // Create a texture to hold the video frame data
        const videoTexture = new pc.Texture(app.graphicsDevice, {
            format: pc.PIXELFORMAT_R5_G6_B5,
            mipmaps: false,
            minFilter: pc.FILTER_LINEAR,
            magFilter: pc.FILTER_LINEAR,
            addressU: pc.ADDRESS_CLAMP_TO_EDGE,
            addressV: pc.ADDRESS_CLAMP_TO_EDGE
        });

        // Grab our HTML element with the video
        const video: HTMLVideoElement = document.createElement('video');
        video.setAttribute('autoplay', 'true');
        video.setAttribute('loop', 'true');
        video.setAttribute('muted', 'true');
        video.setAttribute('playsinline', 'true');
        video.setAttribute('crossorigin', 'anonymous');
        video.setAttribute('style', 'display:none');
        video.setAttribute('id', 'vid');
        const videoSource: HTMLSourceElement = document.createElement('source');
        videoSource.setAttribute('src', 'static/assets/video/SampleVideo_1280x720_1mb.mp4');
        videoSource.setAttribute('type', 'video/mp4');
        video.append(videoSource);
        document.body.append('video');
        video.addEventListener('canplay', function () {
            videoTexture.setSource(video);
        });

        // create an entity to render the tv mesh
        const entity = assets.tv.resource.instantiateRenderEntity();
        app.root.addChild(entity);

        // Create a material that will use our video texture
        const material = new pc.StandardMaterial();
        material.useLighting = false;
        material.emissiveMap = videoTexture;
        material.update();

        // set the material on the screen mesh
        entity.render.meshInstances[1].material = material;

        video.load();
        // video.play();

        const mouse = new pc.Mouse(document.body);
        mouse.on('mousedown', function (event) {
            if (entity && event.buttons[pc.MOUSEBUTTON_LEFT]) {
                video.muted = !video.muted;
            }
        });

        let upload = false;
        let time = 0;
        app.on('update', function (dt) {
            time += dt;

            // rotate the tv object
            entity.setLocalEulerAngles(100 + Math.sin(time) * 50, 0, -90);

            // Upload the video data to the texture every other frame
            upload = !upload;
            if (upload) {
                videoTexture.upload();
            }
        });
    }
}

export default VideoTextureExample;
