import * as pc from '../../../../';

class HelloWorldExample {
    static CATEGORY = 'Misc';
    static NAME = 'Hello World';
    static WEBGPU_ENABLED = true;

    example(canvas: HTMLCanvasElement, deviceType: string): void {

        const gfxOptions = {
            deviceTypes: [deviceType],
            glslangUrl: '/static/lib/glslang/glslang.js',
            twgslUrl: '/static/lib/twgsl/twgsl.js'
        };

        pc.createGraphicsDevice(canvas, gfxOptions).then((device: pc.GraphicsDevice) => {

            const createOptions = new pc.AppOptions();
            createOptions.graphicsDevice = device;

            createOptions.componentSystems = [
                // @ts-ignore
                pc.RenderComponentSystem,
                // @ts-ignore
                pc.CameraComponentSystem,
                // @ts-ignore
                pc.LightComponentSystem
            ];
            createOptions.resourceHandlers = [
                // @ts-ignore
                pc.TextureHandler,
                // @ts-ignore
                pc.ContainerHandler
            ];

            const app = new pc.AppBase(canvas);
            app.init(createOptions);
            app.start();

            // Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
            app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
            app.setCanvasResolution(pc.RESOLUTION_AUTO);

            // create box entity
            const box = new pc.Entity('cube');
            box.addComponent('render', {
                type: 'box'
            });
            app.root.addChild(box);

            // create camera entity
            const camera = new pc.Entity('camera');
            camera.addComponent('camera', {
                clearColor: new pc.Color(0.5, 0.6, 0.9)
            });
            app.root.addChild(camera);
            camera.setPosition(0, 0, 3);

            // create directional light entity
            const light = new pc.Entity('light');
            light.addComponent('light');
            app.root.addChild(light);
            light.setEulerAngles(45, 0, 0);

            // rotate the box according to the delta time since the last frame
            app.on('update', (dt: number) => box.rotate(10 * dt, 20 * dt, 30 * dt));
        });
    }
}

export default HelloWorldExample;
