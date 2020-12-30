// POLYFILLS
import './polyfill/array-find.js';
import './polyfill/math-log2.js';
import './polyfill/math-sign.js';
import './polyfill/object-assign.js';
import './polyfill/pointer-lock.js';
import './polyfill/request-animation-frame.js';
import './polyfill/string.js';
import './polyfill/OESVertexArrayObject.js';

// CORE
export { apps, common, config, data, extend, isDefined, revision, type, version } from './core/core.js';
export { debug } from './core/debug.js';
export { events } from './core/events.js';
export { guid } from './core/guid.js';
export { path } from './core/path.js';
export { platform } from './core/platform.js';
export { string } from './core/string.js';
export { Color } from './core/color.js';
export { EventHandler } from './core/event-handler.js';
export { IndexedList } from './core/indexed-list.js';
export { Tags } from './core/tags.js';
export { Timer, now } from './core/time.js';
export { URI, createURI } from './core/uri.js';

// NET
export { http, Http } from './net/http.js';

// MATH
export * from './math/constants.js';
export { math } from './math/math.js';
export { Curve } from './math/curve.js';
export { CurveSet } from './math/curve-set.js';
export { Mat3 } from './math/mat3.js';
export { Mat4 } from './math/mat4.js';
export { Quat } from './math/quat.js';
export { Vec2 } from './math/vec2.js';
export { Vec3 } from './math/vec3.js';
export { Vec4 } from './math/vec4.js';

// SHAPE
export { BoundingBox } from './shape/bounding-box.js';
export { BoundingSphere } from './shape/bounding-sphere.js';
export { Frustum } from './shape/frustum.js';
export { OrientedBox } from './shape/oriented-box.js';
export { Plane } from './shape/plane.js';
export { Ray } from './shape/ray.js';

// GRAPHICS
export * from './graphics/graphics.js';
export { drawQuadWithShader, drawTexture } from './graphics/simple-post-effect.js';
export { prefilterCubemap, shFromCubemap } from './graphics/prefilter-cubemap.js';
export { reprojectTexture } from './graphics/reproject-texture.js';
export { programlib } from './graphics/program-lib/program-lib.js';
export { shaderChunks } from './graphics/program-lib/chunks/chunks.js';
export { GraphicsDevice } from './graphics/device.js';
export { IndexBuffer } from './graphics/index-buffer.js';
export { PostEffect, drawFullscreenQuad } from './graphics/post-effect.js';
export { ProgramLibrary } from './graphics/program-library.js';
export { RenderTarget } from './graphics/render-target.js';
export { ScopeId } from './graphics/scope-id.js';
export { ScopeSpace } from './graphics/scope-space.js';
export { Shader } from './graphics/shader.js';
export { Texture } from './graphics/texture.js';
export { TransformFeedback } from './graphics/transform-feedback.js';
export { VertexBuffer } from './graphics/vertex-buffer.js';
export { VertexFormat } from './graphics/vertex-format.js';
export { VertexIterator } from './graphics/vertex-iterator.js';

// SCENE
export * from './scene/constants.js';
export { calculateNormals, calculateTangents, createBox, createCapsule, createCone, createCylinder, createMesh, createPlane, createSphere, createTorus } from './scene/procedural.js';
export { BasicMaterial } from './scene/materials/basic-material.js';
export { Batch } from './scene/batching/batch.js';
export { BatchGroup } from './scene/batching/batch-group.js';
export { SkinBatchInstance } from './scene/batching/skin-batch-instance.js';
export { BatchManager } from './scene/batching/batch-manager.js';
export { Camera } from './scene/camera.js';
export { DepthMaterial } from './scene/materials/depth-material.js';
export { ForwardRenderer } from './scene/forward-renderer.js';
export { GraphNode } from './scene/graph-node.js';
export { Layer } from './scene/layer.js';
export { LayerComposition } from './scene/layer-composition.js';
export { Light } from './scene/light.js';
export { Lightmapper } from './scene/lightmapper.js';
export { Material } from './scene/materials/material.js';
export { Mesh } from './scene/mesh.js';
export { MeshInstance, Command } from './scene/mesh-instance.js';
export { Model } from './scene/model.js';
export { Morph } from './scene/morph.js';
export { MorphInstance } from './scene/morph-instance.js';
export { MorphTarget } from './scene/morph-target.js';
export { ParticleEmitter } from './scene/particle-system/particle-emitter.js';
export { Picker } from './scene/pick.js';
export { Scene } from './scene/scene.js';
export { Skin } from './scene/skin.js';
export { SkinInstance } from './scene/skin-instance.js';
export { Sprite } from './scene/sprite.js';
export { StandardMaterial } from './scene/materials/standard-material.js';
export { StencilParameters } from './scene/stencil-parameters.js';
export { TextureAtlas } from './scene/texture-atlas.js';

// ANIMATION
export * from './anim/constants.js';
export { Animation, Key, Node } from './anim/animation.js';
export { Skeleton } from './anim/skeleton.js';
export { AnimBinder, AnimClip, AnimCurve, AnimData, AnimEvaluator, AnimSnapshot, AnimTarget, AnimTrack, DefaultAnimBinder } from './anim/anim.js';

// SOUND
export * from './audio/constants.js';

export { SoundManager } from './sound/manager.js';
export { Sound } from './sound/sound.js';
export { SoundInstance } from './sound/instance.js';
export { SoundInstance3d } from './sound/instance3d.js';

// BUNDLES
export { Bundle } from './bundles/bundle.js';
export { BundleRegistry } from './bundles/bundle-registry.js';

// RESOURCES
export { basisDownload, basisSetDownloadConfig, basisDownloadFromConfig, basisInitialize, basisTargetFormat, basisTranscode } from './resources/basis.js';
export { AnimClipHandler } from './resources/anim-clip.js';
export { AnimStateGraphHandler } from './resources/anim-state-graph.js';
export { AnimationHandler } from './resources/animation.js';
export { AudioHandler } from './resources/audio.js';
export { BasisParser } from './resources/parser/texture/basis.js';
export { BinaryHandler } from './resources/binary.js';
export { BundleHandler } from './resources/bundle.js';
export { ContainerHandler, ContainerResource } from './resources/container.js';
export { createStyle, CssHandler } from './resources/css.js';
export { CubemapHandler } from './resources/cubemap.js';
export { FolderHandler } from './resources/folder.js';
export { FontHandler } from './resources/font.js';
export { HierarchyHandler } from './resources/hierarchy.js';
export { HtmlHandler } from './resources/html.js';
export { ImgParser } from './resources/parser/texture/img.js';
export { JsonHandler } from './resources/json.js';
export { JsonStandardMaterialParser } from './resources/parser/material/json-standard-material.js';
export { KtxParser } from './resources/parser/texture/ktx.js';
export { LegacyDdsParser } from './resources/parser/texture/legacy-dds.js';
export { MaterialHandler } from './resources/material.js';
export { ModelHandler } from './resources/model.js';
export { RenderHandler } from './resources/render.js';
export { ResourceHandler } from './resources/handler.js';
export { ResourceLoader } from './resources/loader.js';
export { ScriptHandler } from './resources/script.js';
export { SceneHandler } from './resources/scene.js';
export { SceneSettingsHandler } from './resources/scene-settings.js';
export { ShaderHandler } from './resources/shader.js';
export { SpriteHandler } from './resources/sprite.js';
export { TemplateHandler } from './resources/template.js';
export { TextHandler } from './resources/text.js';
export { TextureHandler, TextureParser } from './resources/texture.js';
export { TextureAtlasHandler } from './resources/texture-atlas.js';

// ASSETS
export * from './asset/constants.js';
export { Asset } from './asset/asset.js';
export { AssetListLoader } from './asset/asset-list-loader.js';
export { AssetReference } from './asset/asset-reference.js';
export { AssetRegistry } from './asset/asset-registry.js';
export { LocalizedAsset } from './asset/asset-localized.js';

// SCRIPTS
export { createScript, registerScript } from './script/script.js';
export { ScriptAttributes } from './script/script-attributes.js';
export { ScriptRegistry } from './script/script-registry.js';
export { ScriptType } from './script/script-type.js';

// LOCALIZATION
export { I18n } from './i18n/i18n.js';

// INPUT
export * from './input/constants.js';
export { Controller } from './input/controller.js';
export { ElementInput, ElementInputEvent, ElementMouseEvent, ElementSelectEvent, ElementTouchEvent } from './input/element-input.js';
export { GamePads } from './input/game-pads.js';
export { Keyboard, KeyboardEvent } from './input/keyboard.js';
export { Mouse, MouseEvent } from './input/mouse.js';
export { getTouchTargetCoords, Touch, TouchDevice, TouchEvent } from './input/touch.js';

// FRAMEWORK
export * from './framework/constants.js';
export { script } from './framework/script.js';
export { app, Application } from './framework/application.js';
export { AnimationComponent } from './framework/components/animation/component.js';
export { AnimationComponentSystem } from './framework/components/animation/system.js';
export * from './framework/components/anim/constants.js';
export { AnimComponent } from './framework/components/anim/component.js';
export { AnimComponentLayer } from './framework/components/anim/layer.js';
export { AnimComponentSystem } from './framework/components/anim/system.js';
export { AnimController } from './framework/components/anim/controller.js';
export { AnimPropertyLocator } from './framework/components/anim/property-locator.js';
export { AnimStateGraph } from './framework/components/anim/state-graph.js';
export { AudioListenerComponent } from './framework/components/audio-listener/component.js';
export { AudioListenerComponentSystem } from './framework/components/audio-listener/system.js';
export { AudioSourceComponent } from './framework/components/audio-source/component.js';
export { AudioSourceComponentSystem } from './framework/components/audio-source/system.js';
export * from './framework/components/button/constants.js';
export { ButtonComponent } from './framework/components/button/component.js';
export { ButtonComponentSystem } from './framework/components/button/system.js';
export { CameraComponent } from './framework/components/camera/component.js';
export { CameraComponentSystem } from './framework/components/camera/system.js';
export { CanvasFont } from './framework/components/text/canvas-font.js';
export { CollisionComponent } from './framework/components/collision/component.js';
export { CollisionComponentSystem } from './framework/components/collision/system.js';
export { Component } from './framework/components/component.js';
export { ComponentData } from './framework/components/data.js';
export { ComponentSystem } from './framework/components/system.js';
export { ComponentSystemRegistry } from './framework/components/registry.js';
export * from './framework/components/element/constants.js';
export { ElementComponent } from './framework/components/element/component.js';
export { ElementComponentSystem } from './framework/components/element/system.js';
export { ElementDragHelper } from './framework/components/element/element-drag-helper.js';
export { Entity } from './framework/entity.js';
export { EntityReference } from './framework/utils/entity-reference.js';
export { Font, FONT_BITMAP, FONT_MSDF } from './framework/components/text/font.js';
export { ImageElement } from './framework/components/element/image-element.js';
export { LayoutCalculator } from './framework/components/layout-group/layout-calculator.js';
export { LayoutChildComponent } from './framework/components/layout-child/component.js';
export { LayoutChildComponentSystem } from './framework/components/layout-child/system.js';
export * from './framework/components/layout-group/constants.js';
export { LayoutGroupComponent } from './framework/components/layout-group/component.js';
export { LayoutGroupComponentSystem } from './framework/components/layout-group/system.js';
export { LightComponent } from './framework/components/light/component.js';
export { LightComponentSystem } from './framework/components/light/system.js';
export { ModelComponent } from './framework/components/model/component.js';
export { ModelComponentSystem } from './framework/components/model/system.js';
export { ParticleSystemComponent } from './framework/components/particle-system/component.js';
export { ParticleSystemComponentSystem } from './framework/components/particle-system/system.js';
export { PostEffectPass } from './framework/components/camera/post-effect-pass.js';
export { PostEffectQueue } from './framework/components/camera/post-effect-queue.js';
export * from './framework/components/rigid-body/constants.js';
export { RigidBodyComponent } from './framework/components/rigid-body/component.js';
export { RigidBodyComponentSystem, ContactPoint, ContactResult, RaycastResult, SingleContactResult } from './framework/components/rigid-body/system.js';
export { SceneRegistry, SceneRegistryItem } from './framework/scene-registry.js';
export * from './framework/components/screen/constants.js';
export { ScreenComponent } from './framework/components/screen/component.js';
export { ScreenComponentSystem } from './framework/components/screen/system.js';
export { ScriptComponent } from './framework/components/script/component.js';
export { ScriptComponentSystem } from './framework/components/script/system.js';
export { ScriptLegacyComponent } from './framework/components/script-legacy/component.js';
export { ScriptLegacyComponentSystem } from './framework/components/script-legacy/system.js';
export { ScrollbarComponent } from './framework/components/scrollbar/component.js';
export { ScrollbarComponentSystem } from './framework/components/scrollbar/system.js';
export * from './framework/components/scroll-view/constants.js';
export { ScrollViewComponent } from './framework/components/scroll-view/component.js';
export { ScrollViewComponentSystem } from './framework/components/scroll-view/system.js';
export { SortedLoopArray } from './framework/utils/sorted-loop-array.js';
export { SoundSlot } from './framework/components/sound/slot.js';
export { SoundComponent } from './framework/components/sound/component.js';
export { SoundComponentSystem } from './framework/components/sound/system.js';
export * from './framework/components/sprite/constants.js';
export { SpriteAnimationClip } from './framework/components/sprite/sprite-animation-clip.js';
export { SpriteComponent } from './framework/components/sprite/component.js';
export { SpriteComponentSystem } from './framework/components/sprite/system.js';
export { TextElement } from './framework/components/element/text-element.js';
export { ZoneComponent } from './framework/components/zone/component.js';
export { ZoneComponentSystem } from './framework/components/zone/system.js';

// TEMPLATES
export { Template } from './templates/template.js';
export { TemplateUtils } from './templates/template-utils.js';

// VR
export { VrDisplay } from './vr/vr-display.js';
export { VrManager } from './vr/vr-manager.js';

// XR
export * from './xr/constants.js';
export { XrInput } from './xr/xr-input.js';
export { XrInputSource } from './xr/xr-input-source.js';
export { XrLightEstimation } from './xr/xr-light-estimation.js';
export { XrDepthSensing } from './xr/xr-depth-sensing.js';
export { XrManager } from './xr/xr-manager.js';
export { XrHitTest } from './xr/xr-hit-test.js';
export { XrHitTestSource } from './xr/xr-hit-test-source.js';
export { XrDomOverlay } from './xr/xr-dom-overlay.js';

// BACKWARDS COMPATIBILITY
export * from './deprecated.js';
