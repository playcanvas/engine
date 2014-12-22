// Install the heavily namespaced APIs to the global pc namespace for
// backwards compatibility. This will be removed at some point in the future.
pc.anim = {
    Animation: pc.Animation,
    Key: pc.Key,
    Node: pc.Node,
    Skeleton: pc.Skeleton
};

pc.audio = {
    AudioManager: pc.AudioManager,
    Channel: pc.Channel,
    Channel3d: pc.Channel3d,
    Listener: pc.Listener,
    Sound: pc.Sound
};

pc.fw = {
    Application: pc.Application,
    Component: pc.Component,
    ComponentData: pc.ComponentData,
    ComponentSystem: pc.ComponentSystem,    
    Entity: pc.Entity,
    LiveLink: pc.LiveLink,
    LiveLinkMessage: pc.LiveLinkMessage,
    LiveLinkOpenEntityMessage: pc.LiveLinkOpenEntityMessage,
    LiveLinkOpenPackMessage: pc.LiveLinkOpenPackMessage,
    LiveLinkUpdateAssetCacheMessage: pc.LiveLinkUpdateAssetCacheMessage,
    LiveLinkUpdateEntityTransformMessage: pc.LiveLinkUpdateEntityTransformMessage
};

pc.fw.FillMode = {
    NONE: pc.FILLMODE_NONE,
    FILL_WINDOW: pc.FILLMODE_FILL_WINDOW,
    KEEP_ASPECT: pc.FILLMODE_KEEP_ASPECT
};

pc.fw.ResolutionMode = {
    AUTO: pc.RESOLUTION_AUTO,
    FIXED: pc.RESOLUTION_FIXED
};

pc.fw.LiveLinkMessageType = {
    UPDATE_ENTITY: pc.LiveLinkMessageType.UPDATE_ENTITY,
    UPDATE_ENTITY_TRANSFORM: pc.LiveLinkMessageType.UPDATE_ENTITY_TRANSFORM,
    UPDATE_ENTITY_NAME: pc.LiveLinkMessageType.UPDATE_ENTITY_NAME,
    UPDATE_ENTITY_ENABLED: pc.LiveLinkMessageType.UPDATE_ENTITY_ENABLED,
    REPARENT_ENTITY: pc.LiveLinkMessageType.REPARENT_ENTITY
};

pc.extend(pc.gfx, {
    defaultGamma: pc.defaultGamma,
    defaultTonemapping: pc.defaultTonemapping,
    drawQuadWithShader: pc.drawQuadWithShader,
    precalculatedTangents: pc.precalculatedTangents,
    programlib: pc.programlib,
    shaderChunks: pc.shaderChunks,

    ContextCreationError: pc.ContextCreationError,
    Device: pc.GraphicsDevice,
    IndexBuffer: pc.IndexBuffer,
    ProgramLibrary: pc.ProgramLibrary,
    RenderTarget: pc.RenderTarget,
    ScopeId: pc.ScopeId,
    Shader: pc.Shader,
    ShaderInput: pc.ShaderInput,
    Texture: pc.Texture,
    UnsupportedBrowserError: pc.UnsupportedBrowserError,
    VertexBuffer: pc.VertexBuffer,
    VertexFormat: pc.VertexFormat,
    VertexIterator: pc.VertexIterator
});

pc.extend(pc.input, {
    getTouchTargetCoords: pc.getTouchTargetCoords,

    Controller: pc.Controller,
    GamePads: pc.GamePads,
    Keyboard: pc.Keyboard,
    KeyboardEvent: pc.KeyboardEvent,
    Mouse: pc.Mouse,
    MouseEvent: pc.MouseEvent,
    Touch: pc.Touch,
    TouchDevice: pc.TouchDevice,
    TouchEvent: pc.TouchEvent
});

pc.posteffect = {
    createFullscreenQuad: pc.createFullscreenQuad,
    drawFullscreenQuad: pc.drawFullscreenQuad,

    PostEffect: pc.PostEffect,
    PostEffectQueue: pc.PostEffectQueue
};

pc.extend(pc.scene, {
    partitionSkin: pc.partitionSkin,

    BasicMaterial: pc.BasicMaterial,
    CameraNode: pc.CameraNode,
    DepthMaterial: pc.DepthMaterial,
    ForwardRenderer: pc.ForwardRenderer,
    GraphNode: pc.GraphNode,
    LightNode: pc.LightNode,
    Material: pc.Material,
    Command: pc.Command,
    Mesh: pc.Mesh,
    MeshInstance: pc.MeshInstance,
    Model: pc.Model,
    ParticleEmitter: pc.ParticleEmitter,
    PhongMaterial: pc.PhongMaterial,
    Picker: pc.Picker,
    PickMaterial: pc.PickMaterial,
    Scene: pc.Scene,
    Skin: pc.Skin,
    SkinInstance: pc.SkinInstance
});

pc.scene.procedural = {
    calculateTangents: pc.calculateTangents,
    createMesh: pc.createMesh,
    createTorus: pc.createTorus,
    createCylinder: pc.createCylinder,
    createCapsule: pc.createCapsule,
    createCone: pc.createCone,
    createSphere: pc.createSphere,
    createPlane: pc.createPlane,
    createBox: pc.createBox
};

pc.scene.Projection = {
    ORTHOGRAPHIC: pc.PROJECTION_ORTHOGRAPHIC,
    PERSPECTIVE: pc.PROJECTION_PERSPECTIVE
};

pc.time = {
    now: pc.now,

    Timer: pc.Timer
};