import * as pc from 'playcanvas';
import { loadAssets } from './loadAssets.mjs';
import { assetPath, scriptsPath } from '../../assetPath.mjs';
import { enableHotReload } from '../../enableHotReload.mjs';

enableHotReload({
    loadAssets,
    assetPath,
    scriptsPath,
});

/**
 * @param {HTMLCanvasElement} canvas - The canvas.
 * @param {string} deviceType - The device type.
 * @return {Promise<pc.Application>} - The application.
 */
async function example(canvas, deviceType) {
    // Create the app and start the update loop
    const app = new pc.Application(canvas, {
        mouse: new pc.Mouse(document.body),
        touch: new pc.TouchDevice(document.body)
    });

    const assets = {
        statue: new pc.Asset('statue', 'container', { url: assetPath + 'models/statue.glb' }),
        script: new pc.Asset('script', 'script',    { url: scriptsPath + 'camera/orbit-camera.js' })
    };

    await loadAssets(Object.values(assets), app.assets);
    // Create an entity hierarchy representing the statue
    const statueEntity = assets.statue.resource.instantiateRenderEntity();
    statueEntity.setLocalScale(0.07, 0.07, 0.07);
    statueEntity.setLocalPosition(0, -0.5, 0);
    app.root.addChild(statueEntity);

    // Create a camera with an orbit camera script
    const camera = new pc.Entity();
    camera.addComponent("camera", {
        clearColor: new pc.Color(0.4, 0.45, 0.5)
    });
    camera.addComponent("script");
    camera.script.create("orbitCamera", {
        attributes: {
            inertiaFactor: 0.2 // Override default of 0 (no inertia)
        }
    });
    camera.script.create("orbitCameraInputMouse");
    camera.script.create("orbitCameraInputTouch");
    app.root.addChild(camera);

    // Create a directional light
    const light = new pc.Entity();
    light.addComponent("light", {
        type: "directional"
    });
    app.root.addChild(light);
    light.setLocalEulerAngles(45, 30, 0);

    app.start();
    return app;
}

class OrbitExample {
    static CATEGORY = 'Camera';
    static NAME = 'Orbit';
    static example = example;
}

export {
    OrbitExample,
};
