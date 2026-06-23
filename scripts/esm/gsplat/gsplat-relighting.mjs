import {
    Color, Entity, Layer, RenderTarget, Script, Texture,
    ADDRESS_CLAMP_TO_EDGE, FILTER_LINEAR, GAMMA_NONE, PIXELFORMAT_RGBA16F, PIXELFORMAT_SRGBA8,
    SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL, TONEMAP_NONE
} from 'playcanvas';

/**
 * @import { Material } from 'playcanvas'
 */

// outputPS chunk overrides for the proxy mesh material: keep the lit color in RGB and write 1 to
// A, marking the pixel as covered by the mesh. The render target clears alpha to 0, so the alpha
// channel acts as a coverage mask - splats sampling uncovered pixels are left untinted.
const meshOutputGLSL = /* glsl */`
    gl_FragColor.a = 1.0;
`;

const meshOutputWGSL = /* wgsl */`
    output.color = vec4f(output.color.rgb, 1.0);
`;

// gsplatModifyPS chunk: per-pixel relighting. The relighting texture is screen-aligned with the
// main camera, so each fragment samples it at its own screen position - no matrix, no per-splat
// flicker at screen edges. The brightness uniform compensates for the gray albedo of the proxy
// mesh material (2 for 0.5 gray albedo) and allows the overall lighting to be brightened.
const splatModifyGLSL = /* glsl */`
uniform sampler2D uRelightMap;
uniform vec4 uScreenSize;
uniform float uRelightBlend;
uniform float uRelightBrightness;
uniform float uRelightBackground;

void modifySplatColor(vec2 gaussianUV, inout vec4 color) {
    vec4 lit = textureLod(uRelightMap, gl_FragCoord.xy * uScreenSize.zw, 0.0);

    // the texture alpha is a mesh coverage mask - splats not covered by the mesh (e.g. the sky)
    // are modulated by the background multiplier instead of the mesh lighting
    vec3 factor = mix(vec3(uRelightBackground), lit.rgb * uRelightBrightness, lit.a);
    color.rgb = mix(color.rgb, color.rgb * factor, uRelightBlend);
}
`;

const splatModifyWGSL = /* wgsl */`
var uRelightMap: texture_2d<f32>;
var uRelightMapSampler: sampler;
uniform uScreenSize: vec4f;
uniform uRelightBlend: f32;
uniform uRelightBrightness: f32;
uniform uRelightBackground: f32;

fn modifySplatColor(gaussianUV: vec2f, color: ptr<function, vec4f>) {
    let lit = textureSampleLevel(uRelightMap, uRelightMapSampler, pcPosition.xy * uniform.uScreenSize.zw, 0.0);

    // the texture alpha is a mesh coverage mask - splats not covered by the mesh (e.g. the sky)
    // are modulated by the background multiplier instead of the mesh lighting
    let factor = mix(vec3f(uniform.uRelightBackground), lit.rgb * uniform.uRelightBrightness, lit.a);
    *color = vec4f(mix((*color).rgb, (*color).rgb * factor, uniform.uRelightBlend), (*color).a);
}
`;

/**
 * Relights a gaussian splat scene using a proxy mesh. A proxy mesh of the splat scene is lit by
 * standard lights and rendered into an offscreen texture (lit mesh color in RGB, mesh coverage
 * mask in A) by a camera matching the main camera. The texture is screen-aligned with the main
 * camera, so each splat fragment samples the mesh lighting at its own screen position and the
 * splat color is modulated by it per pixel.
 *
 * Attach this script to the entity holding the main camera that renders the gsplat scene. Under
 * the hood it creates a child entity with a camera matching the main camera, which renders a
 * dedicated layer into the texture before the main camera renders. Place the proxy mesh and the
 * lights that should light it on that layer ({@link GsplatRelighting#layer}), and apply
 * {@link GsplatRelighting#configureMaterial} to the proxy mesh material so it writes the
 * coverage mask to alpha.
 *
 * Note: only gsplat components in unified mode are supported - the splat customization is
 * applied to `app.scene.gsplat.material`, and only by the raster gsplat renderers (CPU and GPU
 * sort), as the fragment chunk is not used by the compute renderer.
 */
class GsplatRelighting extends Script {
    static scriptName = 'gsplatRelighting';

    /**
     * Scale of the relighting texture resolution relative to the back buffer.
     * @attribute
     * @range [0.1, 1]
     */
    textureScale = 1;

    /**
     * Priority of the relighting camera. Keep it lower than the main camera priority (default 0)
     * so the relighting texture is rendered first each frame.
     * @attribute
     */
    priority = -1;

    /**
     * Name of the layer the proxy mesh and its lights should be placed on. The layer is created
     * if it does not exist.
     * @attribute
     */
    layerName = 'Relighting';

    /**
     * How much the mesh lighting affects the splat colors. 0 leaves splats unchanged, 1 fully
     * modulates the splat color by the mesh lighting.
     * @attribute
     * @range [0, 1]
     */
    blend = 1;

    /**
     * Brightness of the lighting texture when tinting the splats. The default of 2 compensates
     * for the 0.5 gray albedo of the proxy mesh material.
     * @attribute
     * @range [0, 5]
     */
    brightness = 2;

    /**
     * Multiplier applied to splats not covered by the proxy mesh (e.g. the sky), allowing them
     * to follow the environment exposure.
     * @attribute
     * @range [0, 5]
     */
    background = 1;

    /** @type {Layer|null} */
    _layer = null;

    /** @type {boolean} */
    _ownsLayer = false;

    /** @type {Entity|null} */
    _rtEntity = null;

    /** @type {Texture|null} */
    _texture = null;

    /** @type {RenderTarget|null} */
    _renderTarget = null;

    /** @type {number} */
    _format = PIXELFORMAT_RGBA16F;

    initialize() {
        const camera = this.entity.camera;
        if (!camera) {
            console.error('GsplatRelighting requires a Camera component on the entity.');
            return;
        }

        // HDR format with alpha for the relighting texture, with LDR fallback when not
        // renderable / filterable - sRGB to limit banding as the texture stores linear lighting
        this._format = this.app.graphicsDevice.getRenderableHdrFormat([PIXELFORMAT_RGBA16F], true) ??
            PIXELFORMAT_SRGBA8;

        // find or create the relighting layer
        let layer = this.app.scene.layers.getLayerByName(this.layerName);
        if (!layer) {
            layer = new Layer({ name: this.layerName });
            this.app.scene.layers.push(layer);
            this._ownsLayer = true;
        }
        this._layer = layer;

        // child entity with a camera matching the host camera, rendering the relighting layer
        // into the texture; inherits the host camera world transform automatically
        const rtEntity = new Entity('RelightingCamera');
        rtEntity.addComponent('camera', {
            layers: [layer.id],
            priority: this.priority,
            clearColor: new Color(0, 0, 0, 0),
            fov: camera.fov,
            nearClip: camera.nearClip,
            farClip: camera.farClip,

            // keep the texture linear HDR
            toneMapping: TONEMAP_NONE,
            gammaCorrection: GAMMA_NONE
        });
        this.entity.addChild(rtEntity);
        this._rtEntity = rtEntity;

        this._updateRenderTarget();
        this._applySplatChunk();

        this.on('enable', () => {
            if (this._rtEntity) this._rtEntity.enabled = true;
            this._applySplatChunk();
        });

        this.on('disable', () => {
            if (this._rtEntity) this._rtEntity.enabled = false;
            this._removeSplatChunk();
        });

        this.on('destroy', () => {
            this._removeSplatChunk();
            this._destroyRenderTarget();
            this._rtEntity?.destroy();
            this._rtEntity = null;
            if (this._ownsLayer && this._layer) {
                this.app.scene.layers.remove(this._layer);
            }
            this._layer = null;
        });
    }

    /**
     * The layer the proxy mesh and its lights should be placed on.
     * @type {Layer|null}
     */
    get layer() {
        return this._layer;
    }

    /**
     * The relighting texture: lit mesh color in RGB, mesh coverage mask in A.
     * @type {Texture|null}
     */
    get texture() {
        return this._texture;
    }

    /**
     * Overrides the output shader chunk of a material to write the mesh coverage mask to the
     * alpha channel, as expected by the relighting effect. Apply this to the proxy mesh
     * material.
     *
     * @param {Material} material - The material to configure.
     */
    configureMaterial(material) {
        material.getShaderChunks(SHADERLANGUAGE_GLSL).set('outputPS', meshOutputGLSL);
        material.getShaderChunks(SHADERLANGUAGE_WGSL).set('outputPS', meshOutputWGSL);
        material.shaderChunksVersion = '2.8';
        material.update();
    }

    update() {
        const camera = this.entity.camera;
        const rtCamera = this._rtEntity?.camera;
        if (!camera || !rtCamera) return;

        // keep the relighting camera in sync with the host camera
        rtCamera.fov = camera.fov;
        rtCamera.nearClip = camera.nearClip;
        rtCamera.farClip = camera.farClip;

        this._updateRenderTarget();

        // update the splat customization uniforms on the unified gsplat material
        const material = this.app.scene.gsplat?.material;
        if (material && this._texture) {
            material.setParameter('uRelightMap', this._texture);
            material.setParameter('uRelightBlend', this.blend);
            material.setParameter('uRelightBrightness', this.brightness);
            material.setParameter('uRelightBackground', this.background);
            material.update();
        }
    }

    _applySplatChunk() {
        const material = this.app.scene.gsplat?.material;
        if (!material) return;

        const isWebGPU = this.app.graphicsDevice.isWebGPU;
        const shaderLanguage = isWebGPU ? SHADERLANGUAGE_WGSL : SHADERLANGUAGE_GLSL;
        material.getShaderChunks(shaderLanguage).set('gsplatModifyPS', isWebGPU ? splatModifyWGSL : splatModifyGLSL);
        material.update();
    }

    _removeSplatChunk() {
        const material = this.app.scene.gsplat?.material;
        if (!material) return;

        const shaderLanguage = this.app.graphicsDevice.isWebGPU ? SHADERLANGUAGE_WGSL : SHADERLANGUAGE_GLSL;
        material.getShaderChunks(shaderLanguage).delete('gsplatModifyPS');
        material.update();
    }

    _destroyRenderTarget() {
        this._renderTarget?.destroy();
        this._renderTarget = null;
        this._texture?.destroy();
        this._texture = null;
    }

    _updateRenderTarget() {
        const device = this.app.graphicsDevice;
        const width = Math.max(1, Math.floor(device.width * this.textureScale));
        const height = Math.max(1, Math.floor(device.height * this.textureScale));

        if (this._texture && this._texture.width === width && this._texture.height === height) {
            return;
        }

        this._destroyRenderTarget();

        this._texture = new Texture(device, {
            name: 'RelightingTexture',
            width: width,
            height: height,
            format: this._format,
            mipmaps: false,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });

        this._renderTarget = new RenderTarget({
            name: 'RelightingRT',
            colorBuffer: this._texture,
            depth: true
        });

        if (this._rtEntity?.camera) {
            this._rtEntity.camera.renderTarget = this._renderTarget;
        }
    }
}

export { GsplatRelighting };
