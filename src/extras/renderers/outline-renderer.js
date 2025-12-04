import { Color } from '../../core/math/color.js';
import { Entity } from '../../framework/entity.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import {
    ADDRESS_CLAMP_TO_EDGE, BLENDEQUATION_ADD, BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDMODE_SRC_ALPHA,
    CULLFACE_NONE,
    FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR, PIXELFORMAT_SRGBA8,
    SEMANTIC_POSITION
} from '../../platform/graphics/constants.js';
import { DepthState } from '../../platform/graphics/depth-state.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { drawQuadWithShader } from '../../scene/graphics/quad-render-utils.js';
import { QuadRender } from '../../scene/graphics/quad-render.js';
import { StandardMaterialOptions } from '../../scene/materials/standard-material-options.js';
import { StandardMaterial } from '../../scene/materials/standard-material.js';
import { ShaderUtils } from '../../scene/shader-lib/shader-utils.js';

/**
 * @import { AppBase } from '../../framework/app-base.js'
 * @import { Layer } from "../../scene/layer.js"
 */

// Fragment shader which works on a source image containing objects rendered using a constant color.
// The shader removes the original object color and outputs outline color only.
const shaderOutlineExtendPS = /* glsl */ `

    varying vec2 vUv0;

    uniform vec2 uOffset;
    uniform float uSrcMultiplier;
    uniform sampler2D source;

    void main(void)
    {
        vec4 pixel;
        vec4 texel = texture2D(source, vUv0);
        vec4 firstTexel = texel;
        float diff = texel.a * uSrcMultiplier;

        pixel = texture2D(source, vUv0 + uOffset * -2.0);
        texel = max(texel, pixel);
        diff = max(diff, length(firstTexel.rgb - pixel.rgb));

        pixel = texture2D(source, vUv0 + uOffset * -1.0);
        texel = max(texel, pixel);
        diff = max(diff, length(firstTexel.rgb - pixel.rgb));

        pixel = texture2D(source, vUv0 + uOffset * 1.0);
        texel = max(texel, pixel);
        diff = max(diff, length(firstTexel.rgb - pixel.rgb));

        pixel = texture2D(source, vUv0 + uOffset * 2.0);
        texel = max(texel, pixel);
        diff = max(diff, length(firstTexel.rgb - pixel.rgb));

       gl_FragColor = vec4(texel.rgb, min(diff, 1.0));
    }
`;

// WGSL version of the outline extend shader
const shaderOutlineExtendWGSL = /* wgsl */ `

    varying vUv0: vec2f;

    uniform uOffset: vec2f;
    uniform uSrcMultiplier: f32;
    var source: texture_2d<f32>;
    var sourceSampler: sampler;

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;
        
        var pixel: vec4f;
        var texel = textureSample(source, sourceSampler, input.vUv0);
        let firstTexel = texel;
        var diff = texel.a * uniform.uSrcMultiplier;

        pixel = textureSample(source, sourceSampler, input.vUv0 + uniform.uOffset * -2.0);
        texel = max(texel, pixel);
        diff = max(diff, length(firstTexel.rgb - pixel.rgb));

        pixel = textureSample(source, sourceSampler, input.vUv0 + uniform.uOffset * -1.0);
        texel = max(texel, pixel);
        diff = max(diff, length(firstTexel.rgb - pixel.rgb));

        pixel = textureSample(source, sourceSampler, input.vUv0 + uniform.uOffset * 1.0);
        texel = max(texel, pixel);
        diff = max(diff, length(firstTexel.rgb - pixel.rgb));

        pixel = textureSample(source, sourceSampler, input.vUv0 + uniform.uOffset * 2.0);
        texel = max(texel, pixel);
        diff = max(diff, length(firstTexel.rgb - pixel.rgb));

        output.color = vec4f(texel.rgb, min(diff, 1.0));
        return output;
    }
`;

const _tempFloatArray = new Float32Array(2);
const _tempColor = new Color();

/**
 * Class responsible for rendering color outlines around objects in the scene.
 *
 * @category Graphics
 */
class OutlineRenderer {
    /**
     * Create a new OutlineRenderer.
     *
     * @param {AppBase} app - The application.
     * @param {Layer} [renderingLayer] - A layer used internally to render the outlines. If not
     * provided, the renderer will use the 'Immediate' layer. This needs to be supplied only if the
     * 'Immediate' layer is not present in the scene.
     * @param {number} [priority] - The priority of the camera rendering the outlines. Should be
     * smaller value than the priority of the scene camera, to be updated first. Defaults to -1.
     */
    constructor(app, renderingLayer, priority = -1) {
        this.app = app;

        this.renderingLayer = renderingLayer ?? app.scene.layers.getLayerByName('Immediate');

        this.rt = this.createRenderTarget('OutlineTexture', 1, 1, true);

        // camera which renders the outline texture
        this.outlineCameraEntity = new Entity('OutlineCamera');
        this.outlineCameraEntity.addComponent('camera', {
            layers: [this.renderingLayer.id],
            priority: priority,
            clearColor: new Color(0, 0, 0, 0),
            renderTarget: this.rt
        });

        // custom shader pass for the outline camera
        this.outlineShaderPass = this.outlineCameraEntity.camera.setShaderPass('OutlineShaderPass');

        // function called after the camera has rendered the outline objects to the texture
        this.postRender = (cameraComponent) => {
            if (this.outlineCameraEntity.camera === cameraComponent) {
                this.onPostRender();
            }
        };
        app.scene.on('postrender', this.postRender);

        // add the camera to the scene
        this.app.root.addChild(this.outlineCameraEntity);

        // temporary render target for intermediate steps
        this.tempRt = this.createRenderTarget('OutlineTempTexture', 1, 1, false);

        this.blendState = new BlendState(true, BLENDEQUATION_ADD, BLENDMODE_SRC_ALPHA, BLENDMODE_ONE_MINUS_SRC_ALPHA);

        const device = this.app.graphicsDevice;

        this.shaderExtend = ShaderUtils.createShader(device, {
            uniqueName: 'OutlineExtendShader',
            attributes: { vertex_position: SEMANTIC_POSITION },
            vertexChunk: 'fullscreenQuadVS',
            fragmentGLSL: shaderOutlineExtendPS,
            fragmentWGSL: shaderOutlineExtendWGSL
        });

        this.shaderBlend = ShaderUtils.createShader(device, {
            uniqueName: 'OutlineBlendShader',
            attributes: { vertex_position: SEMANTIC_POSITION },
            vertexChunk: 'fullscreenQuadVS',
            fragmentChunk: 'outputTex2DPS'
        });

        this.quadRenderer = new QuadRender(this.shaderBlend);

        this.whiteTex = new Texture(device, {
            name: 'OutlineWhiteTexture',
            width: 1,
            height: 1,
            format: PIXELFORMAT_SRGBA8,
            mipmaps: false
        });
        const pixels = this.whiteTex.lock();
        pixels.set(new Uint8Array([255, 255, 255, 255]));
        this.whiteTex.unlock();
    }

    /**
     * Destroy the outline renderer and its resources.
     */
    destroy() {

        this.whiteTex.destroy();
        this.whiteTex = null;

        this.outlineCameraEntity.destroy();
        this.outlineCameraEntity = null;

        this.rt.destroyTextureBuffers();
        this.rt.destroy();
        this.rt = null;

        this.tempRt.destroyTextureBuffers();
        this.tempRt.destroy();
        this.tempRt = null;

        this.app.scene.off('postrender', this.postRender);

        this.quadRenderer?.destroy();
        this.quadRenderer = null;
    }

    getMeshInstances(entity, recursive) {
        const meshInstances = [];

        if (entity) {
            const renders = recursive ? entity.findComponents('render') : (entity.render ? [entity.render] : []);
            renders.forEach((render) => {
                if (render.meshInstances) {
                    meshInstances.push(...render.meshInstances);
                }
            });

            const models = recursive ? entity.findComponents('model') : (entity.model ? [entity.model] : []);
            models.forEach((model) => {
                if (model.meshInstances) {
                    meshInstances.push(...model.meshInstances);
                }
            });
        }

        return meshInstances;
    }

    /**
     * Add an entity to the outline renderer.
     *
     * @param {Entity} entity - The entity to add. All MeshInstance of the entity and its
     * descendants will be added.
     * @param {Color} color - The color of the outline.
     * @param {boolean} [recursive] - Whether to add MeshInstances of the entity's descendants.
     * Defaults to true.
     */
    addEntity(entity, color, recursive = true) {
        const meshInstances = this.getMeshInstances(entity, recursive);

        // update all materials
        meshInstances.forEach((meshInstance) => {
            if (meshInstance.material instanceof StandardMaterial) {
                const outlineShaderPass = this.outlineShaderPass;
                meshInstance.material.onUpdateShader = (options) => {

                    if (options.pass === outlineShaderPass) {

                        // custom shader for the outline shader pass, renders single color meshes using emissive color
                        const opts = new StandardMaterialOptions();
                        opts.defines = options.defines;
                        opts.opacityMap = options.opacityMap;
                        opts.opacityMapUv = options.opacityMapUv;
                        opts.opacityMapChannel = options.opacityMapChannel;
                        opts.opacityMapTransform = options.opacityMapTransform;
                        opts.opacityVertexColor = options.opacityVertexColor;
                        opts.opacityVertexColorChannel = options.opacityVertexColorChannel;
                        opts.litOptions.vertexColors = options.litOptions.vertexColors;
                        opts.litOptions.alphaTest = options.litOptions.alphaTest;
                        opts.litOptions.skin = options.litOptions.skin;
                        opts.litOptions.batch = options.litOptions.batch;
                        opts.litOptions.useInstancing = options.litOptions.useInstancing;
                        opts.litOptions.useMorphPosition = options.litOptions.useMorphPosition;
                        opts.litOptions.useMorphNormal = options.litOptions.useMorphNormal;
                        opts.litOptions.useMorphTextureBasedInt = options.litOptions.useMorphTextureBasedInt;
                        opts.litOptions.opacityFadesSpecular = options.litOptions.opacityFadesSpecular;
                        return opts;
                    }

                    return options;
                };

                // set emissive color override for the outline shader pass only
                _tempColor.linear(color);
                const colArray = new Float32Array([_tempColor.r, _tempColor.g, _tempColor.b]);
                meshInstance.setParameter('material_emissive', colArray, 1 << this.outlineShaderPass);
                meshInstance.setParameter('texture_emissiveMap', this.whiteTex, 1 << this.outlineShaderPass);
            }
        });

        this.renderingLayer.addMeshInstances(meshInstances, true);
    }

    /**
     * Remove an entity from the outline renderer.
     *
     * @param {Entity} entity - The entity to remove.
     * @param {boolean} [recursive] - Whether to add MeshInstances of the entity's descendants.
     * Defaults to true.
     */
    removeEntity(entity, recursive = true) {
        const meshInstances = this.getMeshInstances(entity, recursive);
        this.renderingLayer.removeMeshInstances(meshInstances);

        meshInstances.forEach((meshInstance) => {
            if (meshInstance.material instanceof StandardMaterial) {
                meshInstance.material.onUpdateShader = null;
                meshInstance.deleteParameter('material_emissive');
            }
        });
    }

    removeAllEntities() {
        this.renderingLayer.clearMeshInstances();
    }

    blendOutlines() {

        // blend in the outlines texture on top of the rendering
        const device = this.app.graphicsDevice;
        device.scope.resolve('source').setValue(this.rt.colorBuffer);

        device.setDepthState(DepthState.NODEPTH);
        device.setCullMode(CULLFACE_NONE);
        device.setBlendState(this.blendState);
        this.quadRenderer.render();
    }

    onPostRender() {

        // when the outline camera has rendered the outline objects to the texture, process the texture
        // to generate the outline effect
        const device = this.app.graphicsDevice;
        const uOffset = device.scope.resolve('uOffset');
        const uColorBuffer = device.scope.resolve('source');
        const uSrcMultiplier = device.scope.resolve('uSrcMultiplier');
        const { rt, tempRt, shaderExtend } = this;
        const { width, height } = rt;

        // horizontal extend pass
        _tempFloatArray[0] = 1.0 / width / 2.0;
        _tempFloatArray[1] = 0;
        uOffset.setValue(_tempFloatArray);
        uColorBuffer.setValue(rt.colorBuffer);
        uSrcMultiplier.setValue(0.0);
        drawQuadWithShader(device, tempRt, shaderExtend);

        // vertical extend pass
        _tempFloatArray[0] = 0;
        _tempFloatArray[1] = 1.0 / height / 2.0;
        uOffset.setValue(_tempFloatArray);
        uColorBuffer.setValue(tempRt.colorBuffer);
        uSrcMultiplier.setValue(1.0);
        drawQuadWithShader(device, rt, shaderExtend);
    }

    createRenderTarget(name, width, height, depth) {
        // Create texture render target with specified resolution and mipmap generation
        const texture = new Texture(this.app.graphicsDevice, {
            name: name,
            width: width,
            height: height,
            format: PIXELFORMAT_SRGBA8,
            mipmaps: false,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            minFilter: FILTER_LINEAR_MIPMAP_LINEAR,
            magFilter: FILTER_LINEAR
        });

        // render target
        return new RenderTarget({
            colorBuffer: texture,
            depth: depth,
            flipY: this.app.graphicsDevice.isWebGPU
        });
    }

    updateRenderTarget(sceneCamera) {

        // main camera resolution
        const width = sceneCamera.renderTarget?.width ?? this.app.graphicsDevice.width;
        const height = sceneCamera.renderTarget?.height ?? this.app.graphicsDevice.height;

        const outlineCamera = this.outlineCameraEntity.camera;
        if (!outlineCamera.renderTarget || outlineCamera.renderTarget.width !== width || outlineCamera.renderTarget.height !== height) {

            this.rt.resize(width, height);
            this.tempRt.resize(width, height);
        }
    }

    /**
     * Update the outline renderer. Should be called once per frame.
     *
     * @param {Entity} sceneCameraEntity - The camera used to render the scene, which is used to provide
     * the camera properties to the outline rendering camera.
     * @param {Layer} blendLayer - The layer in which the outlines should be rendered.
     * @param {boolean} blendLayerTransparent - Whether the blend layer is transparent.
     */
    frameUpdate(sceneCameraEntity, blendLayer, blendLayerTransparent) {

        const sceneCamera = sceneCameraEntity.camera;
        this.updateRenderTarget(sceneCamera);

        // function called before the scene camera renders a layer
        const evt = this.app.scene.on('prerender:layer', (cameraComponent, layer, transparent) => {
            if (sceneCamera === cameraComponent && transparent === blendLayerTransparent && layer === blendLayer) {
                this.blendOutlines();
                evt.off();
            }
        });

        // copy the transform
        this.outlineCameraEntity.setLocalPosition(sceneCameraEntity.getPosition());
        this.outlineCameraEntity.setLocalRotation(sceneCameraEntity.getRotation());

        // copy other properties from the scene camera
        const outlineCamera = this.outlineCameraEntity.camera;
        outlineCamera.projection = sceneCamera.projection;
        outlineCamera.horizontalFov = sceneCamera.horizontalFov;
        outlineCamera.fov = sceneCamera.fov;
        outlineCamera.orthoHeight = sceneCamera.orthoHeight;
        outlineCamera.nearClip = sceneCamera.nearClip;
        outlineCamera.farClip = sceneCamera.farClip;
    }
}

export { OutlineRenderer };
