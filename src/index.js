/**
 * This module provides the core functionality for the PlayCanvas Engine. It includes the main
 * classes and methods used to create and manage a PlayCanvas application. It provides APIs for
 * graphics, audio, input, physics, asset management, scripting and much more. It also includes an
 * application framework and entity-component system, making it easy to manage the lifetime of your
 * application.
 *
 * @module Engine
 */

// #if _IS_UMD
// POLYFILLS
import './polyfill/array-fill.js';
import './polyfill/array-find.js';
import './polyfill/array-find-index.js';
import './polyfill/math-log2.js';
import './polyfill/math-sign.js';
import './polyfill/number-isfinite.js';
import './polyfill/object-assign.js';
import './polyfill/object-entries.js';
import './polyfill/object-values.js';
import './polyfill/pointer-lock.js';
import './polyfill/string.js';
import './polyfill/typedarray-fill.js';
// #endif

// CORE
export * from './core/constants.js';
export { apps, common, config, data, extend, revision, type, version } from './core/core.js';
export { guid } from './core/guid.js';
export { path } from './core/path.js';
export { platform } from './core/platform.js';
export { string } from './core/string.js';
export { EventHandler } from './core/event-handler.js';
export { EventHandle } from './core/event-handle.js';
export { IndexedList } from './core/indexed-list.js';
export { WasmModule } from './core/wasm-module.js';
export { ReadStream } from './core/read-stream.js';
export { SortedLoopArray } from './core/sorted-loop-array.js';
export { Tags } from './core/tags.js';
export { now } from './core/time.js';
export { URI, createURI } from './core/uri.js';
export { Tracing } from './core/tracing.js';

// CORE / MATH
export * from './core/math/constants.js';
export { math } from './core/math/math.js';
export { Color } from './core/math/color.js';
export { Curve } from './core/math/curve.js';
export { CurveSet } from './core/math/curve-set.js';
export { FloatPacking } from './core/math/float-packing.js';
export { Mat3 } from './core/math/mat3.js';
export { Mat4 } from './core/math/mat4.js';
export { Quat } from './core/math/quat.js';
export { Vec2 } from './core/math/vec2.js';
export { Vec3 } from './core/math/vec3.js';
export { Vec4 } from './core/math/vec4.js';

// CORE / SHAPE
export { BoundingBox } from './core/shape/bounding-box.js';
export { BoundingSphere } from './core/shape/bounding-sphere.js';
export { Frustum } from './core/shape/frustum.js';
export { OrientedBox } from './core/shape/oriented-box.js';
export { Plane } from './core/shape/plane.js';
export { Tri } from './core/shape/tri.js';
export { Ray } from './core/shape/ray.js';

// PLATFORM / AUDIO
export * from './platform/audio/constants.js';

// PLATFORM / GRAPHICS
export * from './platform/graphics/constants.js';
export { createGraphicsDevice } from './platform/graphics/graphics-device-create.js';
export { BindGroupFormat, BindUniformBufferFormat, BindTextureFormat, BindStorageTextureFormat, BindStorageBufferFormat } from './platform/graphics/bind-group-format.js';
export { BlendState } from './platform/graphics/blend-state.js';
export { Compute } from './platform/graphics/compute.js';
export { DepthState } from './platform/graphics/depth-state.js';
export { GraphicsDevice } from './platform/graphics/graphics-device.js';
export { IndexBuffer } from './platform/graphics/index-buffer.js';
export { RenderTarget } from './platform/graphics/render-target.js';
export { RenderPass } from './platform/graphics/render-pass.js';
export { ScopeId } from './platform/graphics/scope-id.js';
export { ScopeSpace } from './platform/graphics/scope-space.js';
export { Shader } from './platform/graphics/shader.js';
export { ShaderProcessorOptions } from './platform/graphics/shader-processor-options.js';   // used by splats in extras
export { ShaderUtils } from './platform/graphics/shader-utils.js';  // used by splats in extras
export { StorageBuffer } from './platform/graphics/storage-buffer.js';
export { Texture } from './platform/graphics/texture.js';
export { TextureUtils } from './platform/graphics/texture-utils.js';
export { TransformFeedback } from './platform/graphics/transform-feedback.js';
export { UniformBufferFormat, UniformFormat } from './platform/graphics/uniform-buffer-format.js';
export { VertexBuffer } from './platform/graphics/vertex-buffer.js';
export { VertexFormat } from './platform/graphics/vertex-format.js';
export { VertexIterator } from './platform/graphics/vertex-iterator.js';

// PLATFORM / GRAPHICS / webgl
export { WebglGraphicsDevice } from './platform/graphics/webgl/webgl-graphics-device.js';

// PLATFORM / GRAPHICS / webgpu
export { WebgpuGraphicsDevice } from './platform/graphics/webgpu/webgpu-graphics-device.js';

// PLATFORM / GRAPHICS / null
export { NullGraphicsDevice } from './platform/graphics/null/null-graphics-device.js';

// PLATFORM / INPUT
export * from './platform/input/constants.js';
export { Controller } from './platform/input/controller.js';
export { GamePads } from './platform/input/game-pads.js';
export { Keyboard } from './platform/input/keyboard.js';
export { KeyboardEvent } from './platform/input/keyboard-event.js';
export { Mouse } from './platform/input/mouse.js';
export { MouseEvent } from './platform/input/mouse-event.js';
export { TouchDevice } from './platform/input/touch-device.js';
export { getTouchTargetCoords, Touch, TouchEvent } from './platform/input/touch-event.js';

// PLATFORM / NET
export { http, Http } from './platform/net/http.js';

// PLATFORM / SOUND
export { SoundManager } from './platform/sound/manager.js';
export { Sound } from './platform/sound/sound.js';
export { SoundInstance } from './platform/sound/instance.js';
export { SoundInstance3d } from './platform/sound/instance3d.js';

// SCENE
export * from './scene/constants.js';
export { drawQuadWithShader, drawTexture } from './scene/graphics/quad-render-utils.js';
export { BasicMaterial } from './scene/materials/basic-material.js';
export { Batch } from './scene/batching/batch.js';
export { BatchGroup } from './scene/batching/batch-group.js';
export { SkinBatchInstance } from './scene/batching/skin-batch-instance.js';
export { BatchManager } from './scene/batching/batch-manager.js';
export { Camera } from './scene/camera.js';
export { LitMaterial } from './scene/materials/lit-material.js';
export { WorldClusters } from './scene/lighting/world-clusters.js';
export { ForwardRenderer } from './scene/renderer/forward-renderer.js';
export { GraphNode } from './scene/graph-node.js';
export { Layer } from './scene/layer.js';
export { LayerComposition } from './scene/composition/layer-composition.js';
export { Light } from './scene/light.js';
export { LightingParams } from './scene/lighting/lighting-params.js';
export { Material } from './scene/materials/material.js';
export { Mesh } from './scene/mesh.js';
export { MeshInstance } from './scene/mesh-instance.js';
export { Model } from './scene/model.js';
export { Morph } from './scene/morph.js';
export { MorphInstance } from './scene/morph-instance.js';
export { MorphTarget } from './scene/morph-target.js';
export { ParticleEmitter } from './scene/particle-system/particle-emitter.js';
export { QuadRender } from './scene/graphics/quad-render.js';
export { Scene } from './scene/scene.js';
export { ShaderPass } from './scene/shader-pass.js';
export { Skin } from './scene/skin.js';
export { SkinInstance } from './scene/skin-instance.js';
export { Sprite } from './scene/sprite.js';
export { StandardMaterial } from './scene/materials/standard-material.js';
export { StandardMaterialOptions } from './scene/materials/standard-material-options.js';
export { StencilParameters } from './platform/graphics/stencil-parameters.js';
export { TextureAtlas } from './scene/texture-atlas.js';

// SCENE / ANIMATION
export { Animation, Key, Node } from './scene/animation/animation.js';
export { Skeleton } from './scene/animation/skeleton.js';

// SCENE / GRAPHICS
export { EnvLighting } from './scene/graphics/env-lighting.js';
export { PostEffect } from './scene/graphics/post-effect.js';
export { RenderPassColorGrab } from './scene/graphics/render-pass-color-grab.js';
export { RenderPassShaderQuad } from './scene/graphics/render-pass-shader-quad.js';
export { shFromCubemap } from './scene/graphics/prefilter-cubemap.js';
export { reprojectTexture } from './scene/graphics/reproject-texture.js';

// SCENE / PROCEDURAL
export { calculateNormals, calculateTangents } from './scene/geometry/geometry-utils.js';
export { CapsuleGeometry } from './scene/geometry/capsule-geometry.js';
export { ConeGeometry } from './scene/geometry/cone-geometry.js';
export { CylinderGeometry } from './scene/geometry/cylinder-geometry.js';
export { DomeGeometry } from './scene/geometry/dome-geometry.js';
export { Geometry } from './scene/geometry/geometry.js';
export { BoxGeometry } from './scene/geometry/box-geometry.js';
export { PlaneGeometry } from './scene/geometry/plane-geometry.js';
export { SphereGeometry } from './scene/geometry/sphere-geometry.js';
export { TorusGeometry } from './scene/geometry/torus-geometry.js';

// SCENE / RENDERER
export { RenderingParams } from './scene/renderer/rendering-params.js';
export { RenderPassForward } from './scene/renderer/render-pass-forward.js';

// SCENE / SHADER-LIB
export { createShader, createShaderFromCode } from './scene/shader-lib/utils.js';
export { getProgramLibrary } from './scene/shader-lib/get-program-library.js';      // used by splats in extras
export { LitShaderOptions } from './scene/shader-lib/programs/lit-shader-options.js';
export { ProgramLibrary } from './scene/shader-lib/program-library.js';
export { shaderChunks } from './scene/shader-lib/chunks/chunks.js';
export { shaderChunksLightmapper } from './scene/shader-lib/chunks/chunks-lightmapper.js';
export { ChunkBuilder } from './scene/shader-lib/chunk-builder.js';     // used by shed
export { ShaderGenerator } from './scene/shader-lib/programs/shader-generator.js';  // used by splats in extras

// SCENE / SPLAT
export { GSplatData } from './scene/gsplat/gsplat-data.js';
export { GSplat } from './scene/gsplat/gsplat.js';
export { GSplatInstance } from './scene/gsplat/gsplat-instance.js';

// FRAMEWORK
export * from './framework/constants.js';
export { script } from './framework/script.js';
export { AppBase, app } from './framework/app-base.js';
export { AppOptions } from './framework/app-options.js';
export { Application } from './framework/application.js';
export { AnimationComponent } from './framework/components/animation/component.js';
export { AnimationComponentSystem } from './framework/components/animation/system.js';
export { AnimComponent } from './framework/components/anim/component.js';
export { AnimComponentLayer } from './framework/components/anim/component-layer.js';
export { AnimComponentSystem } from './framework/components/anim/system.js';
export { AudioListenerComponent } from './framework/components/audio-listener/component.js';
export { AudioListenerComponentSystem } from './framework/components/audio-listener/system.js';
export * from './framework/components/button/constants.js';
export { ButtonComponent } from './framework/components/button/component.js';
export { ButtonComponentSystem } from './framework/components/button/system.js';
export { CameraComponent } from './framework/components/camera/component.js';
export { CameraComponentSystem } from './framework/components/camera/system.js';
export { CollisionComponent } from './framework/components/collision/component.js';
export { CollisionComponentSystem } from './framework/components/collision/system.js';
export { Component } from './framework/components/component.js';
export { ComponentSystem } from './framework/components/system.js';
export { ComponentSystemRegistry } from './framework/components/registry.js';
export * from './framework/components/element/constants.js';
export { ElementComponent } from './framework/components/element/component.js';
export { ElementComponentSystem } from './framework/components/element/system.js';
export { ElementDragHelper } from './framework/components/element/element-drag-helper.js';
export { Entity } from './framework/entity.js';
export { EntityReference } from './framework/utils/entity-reference.js';
export { GSplatComponent } from './framework/components/gsplat/component.js';
export { GSplatComponentSystem } from './framework/components/gsplat/system.js';
export { ImageElement } from './framework/components/element/image-element.js';
export * from './framework/components/joint/constants.js';
export { JointComponent } from './framework/components/joint/component.js';
export { JointComponentSystem } from './framework/components/joint/system.js';
export { LayoutCalculator } from './framework/components/layout-group/layout-calculator.js';
export { LayoutChildComponent } from './framework/components/layout-child/component.js';
export { LayoutChildComponentSystem } from './framework/components/layout-child/system.js';
export * from './framework/components/layout-group/constants.js';
export { LayoutGroupComponent } from './framework/components/layout-group/component.js';
export { LayoutGroupComponentSystem } from './framework/components/layout-group/system.js';
export { LightComponent } from './framework/components/light/component.js';
export { LightComponentSystem } from './framework/components/light/system.js';
export { Lightmapper } from './framework/lightmapper/lightmapper.js';
export { ModelComponent } from './framework/components/model/component.js';
export { ModelComponentSystem } from './framework/components/model/system.js';
export { ParticleSystemComponent } from './framework/components/particle-system/component.js';
export { ParticleSystemComponentSystem } from './framework/components/particle-system/system.js';
export { PostEffectQueue } from './framework/components/camera/post-effect-queue.js';
export { RenderComponent } from './framework/components/render/component.js';
export { RenderComponentSystem } from './framework/components/render/system.js';
export * from './framework/components/rigid-body/constants.js';
export { RigidBodyComponent } from './framework/components/rigid-body/component.js';
export { RigidBodyComponentSystem, ContactPoint, ContactResult, RaycastResult, SingleContactResult } from './framework/components/rigid-body/system.js';
export { SceneRegistry } from './framework/scene-registry.js';
export { SceneRegistryItem } from './framework/scene-registry-item.js';
export * from './framework/components/screen/constants.js';
export { ScreenComponent } from './framework/components/screen/component.js';
export { ScreenComponentSystem } from './framework/components/screen/system.js';
export { ScriptComponent } from './framework/components/script/component.js';
export { ScriptComponentSystem } from './framework/components/script/system.js';
export { ScrollbarComponent } from './framework/components/scrollbar/component.js';
export { ScrollbarComponentSystem } from './framework/components/scrollbar/system.js';
export * from './framework/components/scroll-view/constants.js';
export { ScrollViewComponent } from './framework/components/scroll-view/component.js';
export { ScrollViewComponentSystem } from './framework/components/scroll-view/system.js';
export { SoundSlot } from './framework/components/sound/slot.js';
export { SoundComponent } from './framework/components/sound/component.js';
export { SoundComponentSystem } from './framework/components/sound/system.js';
export * from './framework/components/sprite/constants.js';
export { SpriteAnimationClip } from './framework/components/sprite/sprite-animation-clip.js';
export { SpriteComponent } from './framework/components/sprite/component.js';
export { SpriteComponentSystem } from './framework/components/sprite/system.js';
export { Template } from './framework/template.js';
export { TextElement } from './framework/components/element/text-element.js';
export { ZoneComponent } from './framework/components/zone/component.js';
export { ZoneComponentSystem } from './framework/components/zone/system.js';

// FRAMEWORK / ANIM
export * from './framework/anim/constants.js';
export { AnimBinder } from './framework/anim/binder/anim-binder.js';
export { AnimClip } from './framework/anim/evaluator/anim-clip.js';
export { AnimCurve } from './framework/anim/evaluator/anim-curve.js';
export { AnimData } from './framework/anim/evaluator/anim-data.js';
export { AnimEvaluator } from './framework/anim/evaluator/anim-evaluator.js';
export { AnimSnapshot } from './framework/anim/evaluator/anim-snapshot.js';
export { AnimTarget } from './framework/anim/evaluator/anim-target.js';
export { AnimEvents } from './framework/anim/evaluator/anim-events.js';
export { AnimTrack } from './framework/anim/evaluator/anim-track.js';
export { DefaultAnimBinder } from './framework/anim/binder/default-anim-binder.js';
export * from './framework/anim/controller/constants.js';
export { AnimController } from './framework/anim/controller/anim-controller.js';
export { AnimStateGraph } from './framework/anim/state-graph/anim-state-graph.js';

// FRAMEWORK / ASSETS
export * from './framework/asset/constants.js';
export { Asset } from './framework/asset/asset.js';
export { AssetListLoader } from './framework/asset/asset-list-loader.js';
export { AssetReference } from './framework/asset/asset-reference.js';
export { AssetRegistry } from './framework/asset/asset-registry.js';
export { LocalizedAsset } from './framework/asset/asset-localized.js';

// FRAMEWORK / FONT
export * from './framework/font/constants.js';
export { Font } from './framework/font/font.js';
export { CanvasFont } from './framework/font/canvas-font.js';

// FRAMEWORK / BUNDLE
export { Bundle } from './framework/bundle/bundle.js';
export { BundleRegistry } from './framework/bundle/bundle-registry.js';

// FRAMEWORK / GRAPHICS
export { Picker } from './framework/graphics/picker.js';

// FRAMEWORK / HANDLERS
export { basisInitialize } from './framework/handlers/basis.js';
export { dracoInitialize } from './framework/parsers/draco-decoder.js';
export { AnimClipHandler } from './framework/handlers/anim-clip.js';
export { AnimStateGraphHandler } from './framework/handlers/anim-state-graph.js';
export { AnimationHandler } from './framework/handlers/animation.js';
export { AudioHandler } from './framework/handlers/audio.js';
export { BinaryHandler } from './framework/handlers/binary.js';
export { BundleHandler } from './framework/handlers/bundle.js';
export { ContainerHandler, ContainerResource } from './framework/handlers/container.js';
export { CssHandler } from './framework/handlers/css.js';
export { CubemapHandler } from './framework/handlers/cubemap.js';
export { FolderHandler } from './framework/handlers/folder.js';
export { FontHandler } from './framework/handlers/font.js';
export { GSplatResource } from './framework/parsers/gsplat-resource.js';
export { HierarchyHandler } from './framework/handlers/hierarchy.js';
export { HtmlHandler } from './framework/handlers/html.js';
export { JsonHandler } from './framework/handlers/json.js';
export { MaterialHandler } from './framework/handlers/material.js';
export { ModelHandler } from './framework/handlers/model.js';
export { GSplatHandler } from './framework/handlers/gsplat.js';
export { RenderHandler } from './framework/handlers/render.js';
export { ResourceHandler } from './framework/handlers/handler.js';
export { ResourceLoader } from './framework/handlers/loader.js';
export { ScriptHandler } from './framework/handlers/script.js';
export { SceneHandler } from './framework/handlers/scene.js';
export { SceneSettingsHandler } from './framework/handlers/scene-settings.js';
export { ShaderHandler } from './framework/handlers/shader.js';
export { SpriteHandler } from './framework/handlers/sprite.js';
export { TemplateHandler } from './framework/handlers/template.js';
export { TextHandler } from './framework/handlers/text.js';
export { TextureHandler } from './framework/handlers/texture.js';
export { TextureAtlasHandler } from './framework/handlers/texture-atlas.js';

// FRAMEWORK / INPUT
export { ElementInput, ElementInputEvent, ElementMouseEvent, ElementSelectEvent, ElementTouchEvent } from './framework/input/element-input.js';

// FRAMEWORK / PARSERS
export { JsonStandardMaterialParser } from './framework/parsers/material/json-standard-material.js';

// FRAMEWORK /SCRIPTS
export { createScript, registerScript, getReservedScriptNames } from './framework/script/script-create.js';
export { ScriptAttributes } from './framework/script/script-attributes.js';
export { ScriptRegistry } from './framework/script/script-registry.js';
export { ScriptType } from './framework/script/script-type.js';
export { Script } from './framework/script/script.js';

// FRAMEWORK / LOCALIZATION
export { I18n } from './framework/i18n/i18n.js';

// FRAMEWORK / XR
export * from './framework/xr/constants.js';
export { XrAnchor } from './framework/xr/xr-anchor.js';
export { XrAnchors } from './framework/xr/xr-anchors.js';
export { XrDepthSensing } from './framework/xr/xr-depth-sensing.js';
export { XrDomOverlay } from './framework/xr/xr-dom-overlay.js';
export { XrFinger } from './framework/xr/xr-finger.js';
export { XrHand } from './framework/xr/xr-hand.js';
export { XrHitTest } from './framework/xr/xr-hit-test.js';
export { XrHitTestSource } from './framework/xr/xr-hit-test-source.js';
export { XrImageTracking } from './framework/xr/xr-image-tracking.js';
export { XrInput } from './framework/xr/xr-input.js';
export { XrInputSource } from './framework/xr/xr-input-source.js';
export { XrJoint } from './framework/xr/xr-joint.js';
export { XrLightEstimation } from './framework/xr/xr-light-estimation.js';
export { XrManager } from './framework/xr/xr-manager.js';
export { XrMeshDetection } from './framework/xr/xr-mesh-detection.js';
export { XrPlane } from './framework/xr/xr-plane.js';
export { XrPlaneDetection } from './framework/xr/xr-plane-detection.js';
export { XrTrackedImage } from './framework/xr/xr-tracked-image.js';
export { XrView } from './framework/xr/xr-view.js';
export { XrViews } from './framework/xr/xr-views.js';

// BACKWARDS COMPATIBILITY
export * from './deprecated/deprecated.js';

// EXTRAS
export * from './extras/index.js';
