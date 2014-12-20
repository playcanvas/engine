// Install the heavily namespaced APIs to the global pc namespace for
// backwards compatibility. This will be removed at some point in the future.
pc.anim = {
    Animation: pc.Animation,
    Key: pc.Key,
    Node: pc.Node,
    Skeleton: pc.Skeleton
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

pc.time = {
    now: pc.now,

    Timer: pc.Timer
};