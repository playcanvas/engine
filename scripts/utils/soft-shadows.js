// Vertex Shader: Set Vertex Positions to the Unwrapped UV Positions
const vertexShader = `
    attribute vec3 aPosition;
    attribute vec2 aUv0;

    uniform mat4 matrix_model;
    uniform mat4 matrix_viewProjection;

    varying vec2 vUv0;

    void main(void)
    {
        vUv0 = aUv0;
        gl_Position = vec4((vUv0 - 0.5) * 2.0, 1.0, 1.0); 
    }
`;

const fragmentShader = /* glsl */`
    varying vec2 vUv0;

    uniform sampler2D uDiffuseMap;
    uniform sampler2D uHeightMap;
    uniform float uTime;

    void main(void)
    {
        vec3 texelOld = texture2D(previousShadowMap, vUv).rgb;
        gl_FragColor = mix(texelOld, gl_FragColor.rgb, 1.0/ averagingWindow);
        gl_FragColor.a = 1.0;
    }
`;

// ${shader.vertexShader.slice(0, -1)}
const discard = /* glsl */`
    void main() { };
    void main() { 
        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        discard; 
    }
`;

// create texture and render target for rendering into, including depth buffer
function createRenderTarget(graphicsDevice, width, height, opts = {}) {
    const texture = new pc.Texture(graphicsDevice, {
        name: 'RenderTarget',
        width: width ?? graphicsDevice.width,
        height: height ?? graphicsDevice.height,
        format: pc.PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: pc.FILTER_LINEAR,
        magFilter: pc.FILTER_LINEAR,

        // Override any options passed in
        ...opts
    });
    return new pc.RenderTarget({
        colorBuffer: texture,
        depth: true
    });
}

export class SoftShadows extends pc.Entity {
    /**
     * @type {pc.Entity[]}
     */
    lights = [];

    ambient = 0.5;

    radius = 0.5;

    averagingWindow = 100;

    constructor(app) {
        super('Soft Shadows', app);
        this.app = app;
    }

    initialize() {
        const device = this.app.graphicsDevice;
        this.res = 1024;
        // this.scene = scene
        this.buffer1Active = false;
        this.lights = [];
        this.meshes = [];
        this.object = null;
        this.clearColor = new pc.Color();
        this.clearAlpha = 0;

        // Create the Progressive LightMap Texture
        const opts = {
            type: pc.TYPE_FLOAT16,
            magFilter: pc.FILTER_NEAREST,
            minFilter: pc.FILTER_NEAREST
        };

        this.progressiveLightMap1 = createRenderTarget(device, this.res, this.res, opts);
        this.progressiveLightMap2 = createRenderTarget(device, this.res, this.res, opts);

        // Inject some spicy new logic into a standard phong material
        const material = new pc.StandardMaterial();
        material.forceUv1 = true;
        // const material = new pc.LitMaterial();
        material.chunks.APIVersion = pc.CHUNKAPI_1_65;
        material.chunks.transformVS = '#define UV1LAYOUT\n' + pc.shaderChunks.transformVS; // draw UV1
        material.chunks.basePS = pc.shaderChunks.basePS + 'uniform sampler2D previousShadowMap;\n	uniform float averagingWindow;\n';
        material.chunks.endPS = `
            gl_FragColor.rgb = combineColor(litArgs_albedo, litArgs_sheen_specularity, litArgs_clearcoat_specularity);

            gl_FragColor.rgb += litArgs_emission;
            gl_FragColor.rgb = addFog(gl_FragColor.rgb);

            // vec3 texelOld = texture2D(previousShadowMap, vUv1).rgb;
            gl_FragColor.rgb = vec3(1.0, 1.0, 0.0); // mix(texelOld, gl_FragColor.rgb, 1.0/ averagingWindow);

            #ifndef HDR
            gl_FragColor.rgb = toneMap(gl_FragColor.rgb);
            gl_FragColor.rgb = gammaCorrectOutput(gl_FragColor.rgb);
            #endif
        `;

        material.setParameter('previousShadowMap', this.progressiveLightMap1.colorBuffer);
        material.setParameter('averagingWindow', this.averagingWindow);

        this.material = material;
        this.size = 10;

        const skyLayer = this.app.scene.layers.getLayerById(pc.LAYERID_SKYBOX);
        const layers = this.app.scene.layers.layerList.filter(layer => layer.id === skyLayer.id).map(id => id);

         // Create texture camera, which renders entities in world and skybox layers into the texture
        this.camera = new pc.Entity("RT-Camera");
        this.camera.addComponent("camera", {
            layers,
             // set the priority of textureCamera to lower number than the priority of the main camera (which is at default 0)
             // to make it rendered first each frame
            priority: -1
        });

        this.addComponent('render', {
            type: 'plane',
            material
        });

        this.app.root.addChild(this.camera);
    }

    update() {

        // console.log(this.material.chunks);

        // for (let i = 0; i < this.lights.length; i++) {
        //     const light = this.lights[i];
        //     if (Math.random() > this.ambient) {
        //         light.position.set(
        //         this.position[0] + pc.math.random(-this.radius, this.radius),
        //         this.position[1] + pc.math.random(-this.radius, this.radius),
        //         this.position[2] + pc.math.random(-this.radius, this.radius)
        //     )
        // } else {
        //     let lambda = Math.acos(2 * Math.random() - 1) - Math.PI / 2.0
        //     let phi = 2 * Math.PI * Math.random();
        //     light.position.set(
        //         Math.cos(lambda) * Math.cos(phi) * length,
        //         Math.abs(Math.cos(lambda) * Math.sin(phi) * length),
        //         Math.sin(lambda) * length
        //     )
        // }

        this.material.setParameter('averagingWindow', this.averagingWindow);

        // Ping-pong two surface buffers for reading/writing
        const activeMap = this.buffer1Active ? this.progressiveLightMap1 : this.progressiveLightMap2;
        const inactiveMap = this.buffer1Active ? this.progressiveLightMap2 : this.progressiveLightMap1;
        this.camera.renderTarget = activeMap;
        this.material.setParameter('previousShadowMap', inactiveMap.colorBuffer);
        this.buffer1Active = !this.buffer1Active;

    }
}
