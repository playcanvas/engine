// POLYFILLS
import './polyfill/array-fill.mjs';
import './polyfill/array-find.mjs';
import './polyfill/array-find-index.mjs';
import './polyfill/math-log2.mjs';
import './polyfill/math-sign.mjs';
import './polyfill/number-isfinite.mjs';
import './polyfill/object-assign.mjs';
import './polyfill/object-values.mjs';
import './polyfill/pointer-lock.mjs';
import './polyfill/string.mjs';
import './polyfill/typedarray-fill.mjs';
import './polyfill/OESVertexArrayObject.mjs';

// CORE
export * from './core/constants.mjs';
export { apps, common, config, data, extend, revision, type, version } from './core/core.mjs';
export { events } from './core/events.mjs';
export { guid } from './core/guid.mjs';
export { path } from './core/path.mjs';
export { platform } from './core/platform.mjs';
export { string } from './core/string.mjs';
export { EventHandler } from './core/event-handler.mjs';
export { IndexedList } from './core/indexed-list.mjs';
export { WasmModule } from './core/wasm-module.mjs';
export { ReadStream } from './core/read-stream.mjs';
export { SortedLoopArray } from './core/sorted-loop-array.mjs';
export { Tags } from './core/tags.mjs';
export { now } from './core/time.mjs';
export { URI, createURI } from './core/uri.mjs';
export { Tracing } from './core/tracing.mjs';

// CORE / MATH
export * from './core/math/constants.mjs';
export { math } from './core/math/math.mjs';
export { Color } from './core/math/color.mjs';
export { Curve } from './core/math/curve.mjs';
export { CurveSet } from './core/math/curve-set.mjs';
export { Mat3 } from './core/math/mat3.mjs';
export { Mat4 } from './core/math/mat4.mjs';
export { Quat } from './core/math/quat.mjs';
export { Vec2 } from './core/math/vec2.mjs';
export { Vec3 } from './core/math/vec3.mjs';
export { Vec4 } from './core/math/vec4.mjs';

// CORE / SHAPE
export { BoundingBox } from './core/shape/bounding-box.mjs';
export { BoundingSphere } from './core/shape/bounding-sphere.mjs';
export { Frustum } from './core/shape/frustum.mjs';
export { OrientedBox } from './core/shape/oriented-box.mjs';
export { Plane } from './core/shape/plane.mjs';
export { Ray } from './core/shape/ray.mjs';

// PLATFORM / AUDIO
export * from './platform/audio/constants.mjs';

// PLATFORM / GRAPHICS
export * from './platform/graphics/constants.mjs';
export { createGraphicsDevice } from './platform/graphics/graphics-device-create.mjs';
export { BlendState } from './platform/graphics/blend-state.mjs';
export { DepthState } from './platform/graphics/depth-state.mjs';
export { GraphicsDevice } from './platform/graphics/graphics-device.mjs';
export { IndexBuffer } from './platform/graphics/index-buffer.mjs';
export { RenderTarget } from './platform/graphics/render-target.mjs';
export { ScopeId } from './platform/graphics/scope-id.mjs';
export { ScopeSpace } from './platform/graphics/scope-space.mjs';
export { Shader } from './platform/graphics/shader.mjs';
export { Texture } from './platform/graphics/texture.mjs';
export { TextureUtils } from './platform/graphics/texture-utils.mjs';
export { TransformFeedback } from './platform/graphics/transform-feedback.mjs';
export { VertexBuffer } from './platform/graphics/vertex-buffer.mjs';
export { VertexFormat } from './platform/graphics/vertex-format.mjs';
export { VertexIterator } from './platform/graphics/vertex-iterator.mjs';

// PLATFORM / GRAPHICS / webgl
export { WebglGraphicsDevice } from './platform/graphics/webgl/webgl-graphics-device.mjs';

// PLATFORM / GRAPHICS / webgpu
export { WebgpuGraphicsDevice } from './platform/graphics/webgpu/webgpu-graphics-device.mjs';

// PLATFORM / GRAPHICS / null
export { NullGraphicsDevice } from './platform/graphics/null/null-graphics-device.mjs';

// PLATFORM / INPUT
export * from './platform/input/constants.mjs';
export { Controller } from './platform/input/controller.mjs';
export { GamePads } from './platform/input/game-pads.mjs';
export { Keyboard } from './platform/input/keyboard.mjs';
export { KeyboardEvent } from './platform/input/keyboard-event.mjs';
export { Mouse } from './platform/input/mouse.mjs';
export { MouseEvent } from './platform/input/mouse-event.mjs';
export { TouchDevice } from './platform/input/touch-device.mjs';
export { getTouchTargetCoords, Touch, TouchEvent } from './platform/input/touch-event.mjs';

// PLATFORM / NET
export { http, Http } from './platform/net/http.mjs';

// PLATFORM / SOUND
export { SoundManager } from './platform/sound/manager.mjs';
export { Sound } from './platform/sound/sound.mjs';
export { SoundInstance } from './platform/sound/instance.mjs';
export { SoundInstance3d } from './platform/sound/instance3d.mjs';

// SCENE
export * from './scene/constants.mjs';
export { calculateNormals, calculateTangents, createBox, createCapsule, createCone, createCylinder, createMesh, createPlane, createSphere, createTorus } from './scene/procedural.mjs';
export { drawQuadWithShader, drawTexture } from './scene/graphics/quad-render-utils.mjs';
export { BasicMaterial } from './scene/materials/basic-material.mjs';
export { Batch } from './scene/batching/batch.mjs';
export { BatchGroup } from './scene/batching/batch-group.mjs';
export { SkinBatchInstance } from './scene/batching/skin-batch-instance.mjs';
export { BatchManager } from './scene/batching/batch-manager.mjs';
export { Camera } from './scene/camera.mjs';
export { LitMaterial } from './scene/materials/lit-material.mjs';
export { WorldClusters } from './scene/lighting/world-clusters.mjs';
export { ForwardRenderer } from './scene/renderer/forward-renderer.mjs';
export { GraphNode } from './scene/graph-node.mjs';
export { Layer } from './scene/layer.mjs';
export { LayerComposition } from './scene/composition/layer-composition.mjs';
export { Light } from './scene/light.mjs';
export { LightingParams } from './scene/lighting/lighting-params.mjs';
export { LitShaderOptions } from './scene/shader-lib/programs/lit-shader-options.mjs';
export { Material } from './scene/materials/material.mjs';
export { Mesh } from './scene/mesh.mjs';
export { MeshInstance } from './scene/mesh-instance.mjs';
export { Model } from './scene/model.mjs';
export { Morph } from './scene/morph.mjs';
export { MorphInstance } from './scene/morph-instance.mjs';
export { MorphTarget } from './scene/morph-target.mjs';
export { ParticleEmitter } from './scene/particle-system/particle-emitter.mjs';
export { QuadRender } from './scene/graphics/quad-render.mjs';
export { Scene } from './scene/scene.mjs';
export { ShaderPass } from './scene/shader-pass.mjs';
export { Skin } from './scene/skin.mjs';
export { SkinInstance } from './scene/skin-instance.mjs';
export { Sprite } from './scene/sprite.mjs';
export { StandardMaterial } from './scene/materials/standard-material.mjs';
export { StandardMaterialOptions } from './scene/materials/standard-material-options.mjs';
export { StencilParameters } from './platform/graphics/stencil-parameters.mjs';
export { TextureAtlas } from './scene/texture-atlas.mjs';

// SCENE / ANIMATION
export { Animation, Key, Node } from './scene/animation/animation.mjs';
export { Skeleton } from './scene/animation/skeleton.mjs';

// SCENE / GRAPHICS
export { EnvLighting } from './scene/graphics/env-lighting.mjs';
export { PostEffect } from './scene/graphics/post-effect.mjs';
export { shFromCubemap } from './scene/graphics/prefilter-cubemap.mjs';
export { reprojectTexture } from './scene/graphics/reproject-texture.mjs';

// SCENE / SHADER-LIB
export { createShader, createShaderFromCode } from './scene/shader-lib/utils.mjs';
export { ProgramLibrary } from './scene/shader-lib/program-library.mjs';
export { shaderChunks } from './scene/shader-lib/chunks/chunks.mjs';
export { shaderChunksLightmapper } from './scene/shader-lib/chunks/chunks-lightmapper.mjs';
export { ChunkBuilder } from './scene/shader-lib/chunk-builder.mjs';     // used by shed

// FRAMEWORK
export * from './framework/constants.mjs';
export { script } from './framework/script.mjs';
export { AppBase, app } from './framework/app-base.mjs';
export { AppOptions } from './framework/app-options.mjs';
export { Application } from './framework/application.mjs';
export { AnimationComponent } from './framework/components/animation/component.mjs';
export { AnimationComponentSystem } from './framework/components/animation/system.mjs';
export { AnimComponent } from './framework/components/anim/component.mjs';
export { AnimComponentLayer } from './framework/components/anim/component-layer.mjs';
export { AnimComponentSystem } from './framework/components/anim/system.mjs';
export { AudioListenerComponent } from './framework/components/audio-listener/component.mjs';
export { AudioListenerComponentSystem } from './framework/components/audio-listener/system.mjs';
export { AudioSourceComponent } from './framework/components/audio-source/component.mjs';
export { AudioSourceComponentSystem } from './framework/components/audio-source/system.mjs';
export * from './framework/components/button/constants.mjs';
export { ButtonComponent } from './framework/components/button/component.mjs';
export { ButtonComponentSystem } from './framework/components/button/system.mjs';
export { CameraComponent } from './framework/components/camera/component.mjs';
export { CameraComponentSystem } from './framework/components/camera/system.mjs';
export { CollisionComponent } from './framework/components/collision/component.mjs';
export { CollisionComponentSystem } from './framework/components/collision/system.mjs';
export { Component } from './framework/components/component.mjs';
export { ComponentSystem } from './framework/components/system.mjs';
export { ComponentSystemRegistry } from './framework/components/registry.mjs';
export * from './framework/components/element/constants.mjs';
export { ElementComponent } from './framework/components/element/component.mjs';
export { ElementComponentSystem } from './framework/components/element/system.mjs';
export { ElementDragHelper } from './framework/components/element/element-drag-helper.mjs';
export { Entity } from './framework/entity.mjs';
export { EntityReference } from './framework/utils/entity-reference.mjs';
export { ImageElement } from './framework/components/element/image-element.mjs';
export * from './framework/components/joint/constants.mjs';
export { JointComponent } from './framework/components/joint/component.mjs';
export { JointComponentSystem } from './framework/components/joint/system.mjs';
export { LayoutCalculator } from './framework/components/layout-group/layout-calculator.mjs';
export { LayoutChildComponent } from './framework/components/layout-child/component.mjs';
export { LayoutChildComponentSystem } from './framework/components/layout-child/system.mjs';
export * from './framework/components/layout-group/constants.mjs';
export { LayoutGroupComponent } from './framework/components/layout-group/component.mjs';
export { LayoutGroupComponentSystem } from './framework/components/layout-group/system.mjs';
export { LightComponent } from './framework/components/light/component.mjs';
export { LightComponentSystem } from './framework/components/light/system.mjs';
export { Lightmapper } from './framework/lightmapper/lightmapper.mjs';
export { ModelComponent } from './framework/components/model/component.mjs';
export { ModelComponentSystem } from './framework/components/model/system.mjs';
export { ParticleSystemComponent } from './framework/components/particle-system/component.mjs';
export { ParticleSystemComponentSystem } from './framework/components/particle-system/system.mjs';
export { PostEffectQueue } from './framework/components/camera/post-effect-queue.mjs';
export { RenderComponent } from './framework/components/render/component.mjs';
export { RenderComponentSystem } from './framework/components/render/system.mjs';
export * from './framework/components/rigid-body/constants.mjs';
export { RigidBodyComponent } from './framework/components/rigid-body/component.mjs';
export { RigidBodyComponentSystem, ContactPoint, ContactResult, RaycastResult, SingleContactResult } from './framework/components/rigid-body/system.mjs';
export { SceneRegistry } from './framework/scene-registry.mjs';
export { SceneRegistryItem } from './framework/scene-registry-item.mjs';
export * from './framework/components/screen/constants.mjs';
export { ScreenComponent } from './framework/components/screen/component.mjs';
export { ScreenComponentSystem } from './framework/components/screen/system.mjs';
export { ScriptComponent } from './framework/components/script/component.mjs';
export { ScriptComponentSystem } from './framework/components/script/system.mjs';
export { ScriptLegacyComponent } from './framework/components/script-legacy/component.mjs';
export { ScriptLegacyComponentSystem } from './framework/components/script-legacy/system.mjs';
export { ScrollbarComponent } from './framework/components/scrollbar/component.mjs';
export { ScrollbarComponentSystem } from './framework/components/scrollbar/system.mjs';
export * from './framework/components/scroll-view/constants.mjs';
export { ScrollViewComponent } from './framework/components/scroll-view/component.mjs';
export { ScrollViewComponentSystem } from './framework/components/scroll-view/system.mjs';
export { SoundSlot } from './framework/components/sound/slot.mjs';
export { SoundComponent } from './framework/components/sound/component.mjs';
export { SoundComponentSystem } from './framework/components/sound/system.mjs';
export * from './framework/components/sprite/constants.mjs';
export { SpriteAnimationClip } from './framework/components/sprite/sprite-animation-clip.mjs';
export { SpriteComponent } from './framework/components/sprite/component.mjs';
export { SpriteComponentSystem } from './framework/components/sprite/system.mjs';
export { Template } from './framework/template.mjs';
export { TextElement } from './framework/components/element/text-element.mjs';
export { ZoneComponent } from './framework/components/zone/component.mjs';
export { ZoneComponentSystem } from './framework/components/zone/system.mjs';

// FRAMEWORK / ANIM
export * from './framework/anim/constants.mjs';
export { AnimBinder } from './framework/anim/binder/anim-binder.mjs';
export { AnimClip } from './framework/anim/evaluator/anim-clip.mjs';
export { AnimCurve } from './framework/anim/evaluator/anim-curve.mjs';
export { AnimData } from './framework/anim/evaluator/anim-data.mjs';
export { AnimEvaluator } from './framework/anim/evaluator/anim-evaluator.mjs';
export { AnimSnapshot } from './framework/anim/evaluator/anim-snapshot.mjs';
export { AnimTarget } from './framework/anim/evaluator/anim-target.mjs';
export { AnimEvents } from './framework/anim/evaluator/anim-events.mjs';
export { AnimTrack } from './framework/anim/evaluator/anim-track.mjs';
export { DefaultAnimBinder } from './framework/anim/binder/default-anim-binder.mjs';
export * from './framework/anim/controller/constants.mjs';
export { AnimController } from './framework/anim/controller/anim-controller.mjs';
export { AnimStateGraph } from './framework/anim/state-graph/anim-state-graph.mjs';

// FRAMEWORK / ASSETS
export * from './framework/asset/constants.mjs';
export { Asset } from './framework/asset/asset.mjs';
export { AssetListLoader } from './framework/asset/asset-list-loader.mjs';
export { AssetReference } from './framework/asset/asset-reference.mjs';
export { AssetRegistry } from './framework/asset/asset-registry.mjs';
export { LocalizedAsset } from './framework/asset/asset-localized.mjs';

// FRAMEWORK / FONT
export * from './framework/font/constants.mjs';
export { Font } from './framework/font/font.mjs';
export { CanvasFont } from './framework/font/canvas-font.mjs';

// FRAMEWORK / BUNDLE
export { Bundle } from './framework/bundle/bundle.mjs';
export { BundleRegistry } from './framework/bundle/bundle-registry.mjs';

// FRAMEWORK / GRAPHICS
export { Picker } from './framework/graphics/picker.mjs';

// FRAMEWORK / HANDLERS
export { basisInitialize } from './framework/handlers/basis.mjs';
export { dracoInitialize } from './framework/parsers/draco-decoder.mjs';
export { AnimClipHandler } from './framework/handlers/anim-clip.mjs';
export { AnimStateGraphHandler } from './framework/handlers/anim-state-graph.mjs';
export { AnimationHandler } from './framework/handlers/animation.mjs';
export { AudioHandler } from './framework/handlers/audio.mjs';
export { BinaryHandler } from './framework/handlers/binary.mjs';
export { BundleHandler } from './framework/handlers/bundle.mjs';
export { ContainerHandler, ContainerResource } from './framework/handlers/container.mjs';
export { CssHandler } from './framework/handlers/css.mjs';
export { CubemapHandler } from './framework/handlers/cubemap.mjs';
export { FolderHandler } from './framework/handlers/folder.mjs';
export { FontHandler } from './framework/handlers/font.mjs';
export { HierarchyHandler } from './framework/handlers/hierarchy.mjs';
export { HtmlHandler } from './framework/handlers/html.mjs';
export { JsonHandler } from './framework/handlers/json.mjs';
export { MaterialHandler } from './framework/handlers/material.mjs';
export { ModelHandler } from './framework/handlers/model.mjs';
export { RenderHandler } from './framework/handlers/render.mjs';
export { ResourceHandler } from './framework/handlers/handler.mjs';
export { ResourceLoader } from './framework/handlers/loader.mjs';
export { ScriptHandler } from './framework/handlers/script.mjs';
export { SceneHandler } from './framework/handlers/scene.mjs';
export { SceneSettingsHandler } from './framework/handlers/scene-settings.mjs';
export { ShaderHandler } from './framework/handlers/shader.mjs';
export { SpriteHandler } from './framework/handlers/sprite.mjs';
export { TemplateHandler } from './framework/handlers/template.mjs';
export { TextHandler } from './framework/handlers/text.mjs';
export { TextureHandler, TextureParser } from './framework/handlers/texture.mjs';
export { TextureAtlasHandler } from './framework/handlers/texture-atlas.mjs';

// FRAMEWORK / INPUT
export { ElementInput, ElementInputEvent, ElementMouseEvent, ElementSelectEvent, ElementTouchEvent } from './framework/input/element-input.mjs';

// FRAMEWORK / PARSERS
export { JsonStandardMaterialParser } from './framework/parsers/material/json-standard-material.mjs';

// FRAMEWORK /SCRIPTS
export { createScript, registerScript, getReservedScriptNames } from './framework/script/script.mjs';
export { ScriptAttributes } from './framework/script/script-attributes.mjs';
export { ScriptRegistry } from './framework/script/script-registry.mjs';
export { ScriptType } from './framework/script/script-type.mjs';

// FRAMEWORK / LOCALIZATION
export { I18n } from './framework/i18n/i18n.mjs';

// FRAMEWORK / XR
export * from './framework/xr/constants.mjs';
export { XrInput } from './framework/xr/xr-input.mjs';
export { XrInputSource } from './framework/xr/xr-input-source.mjs';
export { XrLightEstimation } from './framework/xr/xr-light-estimation.mjs';
export { XrDepthSensing } from './framework/xr/xr-depth-sensing.mjs';
export { XrManager } from './framework/xr/xr-manager.mjs';
export { XrHitTest } from './framework/xr/xr-hit-test.mjs';
export { XrHitTestSource } from './framework/xr/xr-hit-test-source.mjs';
export { XrImageTracking } from './framework/xr/xr-image-tracking.mjs';
export { XrTrackedImage } from './framework/xr/xr-tracked-image.mjs';
export { XrDomOverlay } from './framework/xr/xr-dom-overlay.mjs';
export { XrAnchors } from './framework/xr/xr-anchors.mjs';
export { XrAnchor } from './framework/xr/xr-anchor.mjs';
export { XrPlaneDetection } from './framework/xr/xr-plane-detection.mjs';
export { XrPlane } from './framework/xr/xr-plane.mjs';

// BACKWARDS COMPATIBILITY
export * from './deprecated/deprecated.mjs';
