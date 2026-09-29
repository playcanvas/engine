import { Debug } from '../../core/debug.js';
import { Color } from '../../core/math/color.js';
import { Entity } from '../../framework/entity.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import {
    ADDRESS_CLAMP_TO_EDGE, BLENDEQUATION_ADD, BLENDMODE_ONE_MINUS_SRC_ALPHA, BLENDMODE_SRC_ALPHA,
    FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR, PIXELFORMAT_SRGBA8,
    RENDERTARGET_ORIGIN_BOTTOM,
    SEMANTIC_POSITION
} from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { drawQuadWithShader } from '../../scene/graphics/quad-render-utils.js';
import { QuadRender } from '../../scene/graphics/quad-render.js';
import { ShaderUtils } from '../../scene/shader-lib/shader-utils.js';

/**
 * @import { AppBase } from '../../framework/app-base.js'
 * @import { Layer } from "../../scene/layer.js"
 * @import { MeshInstance } from '../../scene/mesh-instance.js'
 * @import { StandardMaterial } from '../../scene/materials/standard-material.js'
 */

// Whether a render or model component currently has its mesh instances in the scene's layers.
// Entity#enabled already accounts for the whole ancestor chain.
const isRendered = component => component.enabled && component.entity.enabled;

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
 * The OutlineRenderer draws solid color outlines around the silhouettes of entities, for example
 * to highlight objects that are selected or hovered in an editor. Each entity can be outlined in
 * its own color.
 *
 * The outlines are generated in three steps:
 *
 * - An internal camera renders the mesh instances of the added entities into an offscreen texture
 * matching the resolution of the scene camera, with each object drawn in its outline color.
 * - The edges of the objects in the texture are detected and expanded to form the outlines.
 * - The outlines are composited on top of the scene, just before the scene camera renders the
 * layer passed to {@link OutlineRenderer#frameUpdate}.
 *
 * The outlines are drawn over everything the scene camera has rendered up to that layer, so they
 * remain visible when the outlined objects are occluded by other objects. Anything rendered in
 * that layer or after it, such as gizmos, is drawn on top of the outlines.
 *
 * {@link OutlineRenderer#frameUpdate} needs to be called every frame to keep the outlines in sync
 * with the scene camera. Only render and model components are outlined, and the outline color is
 * applied to mesh instances using a {@link StandardMaterial}.
 *
 * Relevant Engine API examples:
 *
 * - [Outlines Colored](https://playcanvas.github.io/#/graphics/outlines-colored)
 * - [Editor](https://playcanvas.github.io/#/misc/editor)
 *
 * @example
 * // Create a layer used to render the outlined objects. It is added to the layer composition, but
 * // not to the scene camera, so that the camera does not render the outlined objects a second time.
 * const outlineLayer = new Layer({ name: 'OutlineLayer' });
 * app.scene.layers.push(outlineLayer);
 *
 * // Create the outline renderer
 * const outlineRenderer = new OutlineRenderer(app, outlineLayer);
 *
 * // Outline an entity and its descendants in red, and another entity in white
 * outlineRenderer.addEntity(entity1, Color.RED);
 * outlineRenderer.addEntity(entity2, Color.WHITE);
 *
 * // Each frame, composite the outlines into the scene before the scene camera renders the opaque
 * // part of the 'Immediate' layer
 * const immediateLayer = app.scene.layers.getLayerByName('Immediate');
 * app.on('update', () => {
 *     outlineRenderer.frameUpdate(cameraEntity, immediateLayer, false);
 * });
 *
 * // Later, stop outlining the first entity
 * outlineRenderer.removeEntity(entity1);
 *
 * @category Graphics
 */
class OutlineRenderer {
    /**
     * Create a new OutlineRenderer.
     *
     * @param {AppBase} app - The application.
     * @param {Layer} [renderingLayer] - The layer the outlined mesh instances are added to, and
     * which the internal outline camera renders. It must be part of the scene's layer composition.
     * Defaults to the 'Immediate' layer. As the scene camera renders the 'Immediate' layer by
     * default, the outlined objects are then rendered by the scene camera a second time - to avoid
     * this, supply a dedicated layer which is not rendered by any other camera.
     * @param {number} [priority] - The priority of the internal outline camera. It needs to render
     * before the scene camera, so it has to be smaller than the priority of the scene camera.
     * Defaults to -1.
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

        // custom shader pass for the outline camera, in which the lit shader outputs the outline
        // color. The standard material evaluates only its opacity for it.
        this.outlineShaderPass = this.outlineCameraEntity.camera.setShaderPass('pcOutline');

        // function called after the camera has rendered the outline objects to the texture
        this.postRender = (cameraComponent) => {
            if (this.outlineCameraEntity.camera === cameraComponent) {
                this.onPostRender();
            }
        };
        app.scene.on('postrender', this.postRender);

        // the scene camera and the layer before which the outlines are composited, set by
        // frameUpdate. The camera is cleared once the outlines are composited, so that they are
        // composited at most once per update, even if frameUpdate was called on frames in which
        // the scene camera did not render the layer.
        this.blendCamera = null;
        this.blendLayer = null;
        this.blendLayerTransparent = false;

        // function called before a camera renders a layer, which composites the outlines
        this.preRenderLayer = (cameraComponent, layer, transparent) => {
            if (this.blendCamera === cameraComponent && this.blendLayer === layer && this.blendLayerTransparent === transparent) {
                this.blendCamera = null;
                this.blendOutlines();
            }
        };
        app.scene.on('prerender:layer', this.preRenderLayer);

        // the mesh instances added by this renderer. The rendering layer can be shared, so only
        // these are removed from it and reset.
        this.outlinedMeshInstances = new Set();

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
    }

    /**
     * Destroy the outline renderer and its resources. All entities are removed from the outline
     * renderer first.
     */
    destroy() {

        // remove the outlined mesh instances from the rendering layer, which can outlive this renderer
        this.removeAllEntities();

        this.outlineCameraEntity.destroy();
        this.outlineCameraEntity = null;

        this.rt.destroyTextureBuffers();
        this.rt.destroy();
        this.rt = null;

        this.tempRt.destroyTextureBuffers();
        this.tempRt.destroy();
        this.tempRt = null;

        this.app.scene.off('postrender', this.postRender);
        this.app.scene.off('prerender:layer', this.preRenderLayer);
        this.blendCamera = null;
        this.blendLayer = null;

        this.quadRenderer?.destroy();
        this.quadRenderer = null;
    }

    /**
     * Collect the mesh instances of an entity's render and model components.
     *
     * @param {Entity} entity - The entity to collect from.
     * @param {boolean} recursive - Whether to include the entity's descendants.
     * @param {boolean} [includeDisabled] - Whether to include components that are not rendered.
     * Defaults to false, which is what an entity being added wants: a disabled component's mesh
     * instances are removed from the scene's layers, but the outline layer keeps its own list, so
     * including them would outline objects that are not drawn. Removal passes true, so an entity
     * disabled after it was added can still be removed.
     * @returns {MeshInstance[]} The mesh instances.
     * @ignore
     */
    getMeshInstances(entity, recursive, includeDisabled = false) {
        const meshInstances = [];

        if (entity) {
            const renders = recursive ? entity.findComponents('render') : (entity.render ? [entity.render] : []);
            renders.forEach((render) => {
                if (render.meshInstances && (includeDisabled || isRendered(render))) {
                    meshInstances.push(...render.meshInstances);
                }
            });

            const models = recursive ? entity.findComponents('model') : (entity.model ? [entity.model] : []);
            models.forEach((model) => {
                if (model.meshInstances && (includeDisabled || isRendered(model))) {
                    meshInstances.push(...model.meshInstances);
                }
            });
        }

        return meshInstances;
    }

    /**
     * Add an entity to the outline renderer, to draw an outline around it. The mesh instances of
     * the entity's render and model components are outlined, including those of its descendants
     * unless `recursive` is false. Adding an entity that is already outlined changes its outline
     * color.
     *
     * Render and model components that are not currently rendered, because they or their entity
     * are disabled, are skipped - this is evaluated when the entity is added.
     *
     * An entity should be outlined by a single outline renderer at a time. The outline color is
     * stored on its mesh instances, so they cannot be outlined by more than one renderer, and
     * removing them from one renderer would remove their outline from the other as well.
     *
     * @param {Entity} entity - The entity to add.
     * @param {Color} color - The color of the outline. The alpha component is ignored.
     * @param {boolean} [recursive] - Whether to also add the mesh instances of the entity's
     * descendants. Defaults to true.
     * @example
     * // outline an entity and its descendants in orange
     * outlineRenderer.addEntity(entity, new Color(1, 0.5, 0));
     */
    addEntity(entity, color, recursive = true) {
        const meshInstances = this.getMeshInstances(entity, recursive);

        // a mesh instance with an outline color this renderer did not set is outlined elsewhere
        Debug.call(() => {
            const shared = meshInstances.find(meshInstance => !this.outlinedMeshInstances.has(meshInstance) &&
                meshInstance.getParameter('pcOutlineColor'));
            if (shared) {
                Debug.warnOnce(`OutlineRenderer#addEntity: the mesh instance of '${shared.node?.name}' is already outlined by another outline renderer, which is not supported.`);
            }
        });

        // the materials are not modified - the outline camera renders them with its shader pass,
        // in which the lit shader outputs this color instead of the lit result
        _tempColor.linear(color);
        const colorArray = new Float32Array([_tempColor.r, _tempColor.g, _tempColor.b]);
        meshInstances.forEach((meshInstance) => {
            this.outlinedMeshInstances.add(meshInstance);
            meshInstance.setParameter('pcOutlineColor', colorArray);
        });

        this.renderingLayer.addMeshInstances(meshInstances, true);
    }

    /**
     * Remove an entity from the outline renderer, to stop drawing its outline. This also works for
     * an entity that has been disabled since it was added.
     *
     * @param {Entity} entity - The entity to remove.
     * @param {boolean} [recursive] - Whether to also remove the mesh instances of the entity's
     * descendants. Defaults to true.
     * @example
     * outlineRenderer.removeEntity(entity);
     */
    removeEntity(entity, recursive = true) {
        // include disabled components, so an entity disabled after it was added is still removed
        const meshInstances = this.getMeshInstances(entity, recursive, true);
        this.removeMeshInstances(meshInstances.filter(meshInstance => this.outlinedMeshInstances.has(meshInstance)));
    }

    /**
     * Remove all entities from the outline renderer, for example to clear the selection.
     *
     * @example
     * // outline only the newly selected entity
     * outlineRenderer.removeAllEntities();
     * outlineRenderer.addEntity(selectedEntity, Color.WHITE);
     */
    removeAllEntities() {
        this.removeMeshInstances([...this.outlinedMeshInstances]);
    }

    /**
     * Remove outlined mesh instances from the rendering layer and delete their outline color.
     *
     * @param {MeshInstance[]} meshInstances - The mesh instances, all added by this renderer.
     * @ignore
     */
    removeMeshInstances(meshInstances) {
        this.renderingLayer.removeMeshInstances(meshInstances);

        meshInstances.forEach((meshInstance) => {
            this.outlinedMeshInstances.delete(meshInstance);
            meshInstance.deleteParameter('pcOutlineColor');
        });
    }

    blendOutlines() {

        // blend in the outlines texture on top of the rendering
        const device = this.app.graphicsDevice;
        device.scope.resolve('source').setValue(this.rt.colorBuffer);

        device.setDrawStates(this.blendState);
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
        drawQuadWithShader(device, tempRt, shaderExtend, undefined, undefined, 'OutlineExpand');

        // vertical extend pass
        _tempFloatArray[0] = 0;
        _tempFloatArray[1] = 1.0 / height / 2.0;
        uOffset.setValue(_tempFloatArray);
        uColorBuffer.setValue(tempRt.colorBuffer);
        uSrcMultiplier.setValue(1.0);
        drawQuadWithShader(device, rt, shaderExtend, undefined, undefined, 'OutlineExpand');
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

        // render target - the outline texture is composited using a raw-uv fullscreen quad
        // written against the WebGL layout, so replicate it on all graphics APIs
        return new RenderTarget({
            colorBuffer: texture,
            depth: depth,
            origin: RENDERTARGET_ORIGIN_BOTTOM
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
     * Update the outline renderer. This needs to be called once per frame, after the scene camera
     * has been positioned, for example from the application's `update` event, which fires after
     * scripts have been updated. It matches the internal outline camera to the scene camera's
     * transform, projection, clip planes and resolution, and schedules the outlines to be
     * composited into the scene for this frame.
     *
     * The outlines are composited just before the scene camera renders the opaque or transparent
     * part of `blendLayer`, so that part of the layer, and everything rendered after it, is drawn
     * on top of the outlines. The scene camera needs to render `blendLayer`, otherwise the
     * outlines are not visible.
     *
     * @param {Entity} sceneCameraEntity - The entity with the camera component used to render the
     * scene.
     * @param {Layer} blendLayer - The layer before which the outlines are composited.
     * @param {boolean} blendLayerTransparent - True to composite the outlines before the
     * transparent part of `blendLayer`, false to composite them before its opaque part.
     * @example
     * const immediateLayer = app.scene.layers.getLayerByName('Immediate');
     * app.on('update', () => {
     *     outlineRenderer.frameUpdate(cameraEntity, immediateLayer, false);
     * });
     */
    frameUpdate(sceneCameraEntity, blendLayer, blendLayerTransparent) {

        const sceneCamera = sceneCameraEntity.camera;
        this.updateRenderTarget(sceneCamera);

        // composite the outlines before the scene camera renders the blend layer
        this.blendCamera = sceneCamera;
        this.blendLayer = blendLayer;
        this.blendLayerTransparent = blendLayerTransparent;

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
