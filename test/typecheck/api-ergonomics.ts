import type {
    AnimComponent,
    CameraComponent,
    CollisionComponent,
    Camera,
    ElementComponent,
    Entity,
    GraphNode,
    LightComponent,
    Material,
    MeshInstance,
    ModelComponent,
    ParticleSystemComponent,
    RenderComponent,
    RigidBodyComponent,
    Scene,
    ScriptComponent,
    SoundComponent,
    SpriteComponent
} from '../../build/playcanvas.js';

declare const anim: AnimComponent;
declare const camera: Camera;
declare const cameraComponent: CameraComponent;
declare const collision: CollisionComponent;
declare const element: ElementComponent;
declare const entity: Entity;
declare const graphNode: GraphNode;
declare const light: LightComponent;
declare const material: Material;
declare const meshes: MeshInstance[];
declare const model: ModelComponent;
declare const particles: ParticleSystemComponent;
declare const render: RenderComponent;
declare const rigidbody: RigidBodyComponent;
declare const scene: Scene;
declare const script: ScriptComponent;
declare const sound: SoundComponent;
declare const sprite: SpriteComponent;

render.meshInstances = meshes;
model.meshInstances = meshes;

// @ts-expect-error engine-owned arrays must be replaced through their setter/helper
render.meshInstances.push(meshes[0]);
// @ts-expect-error engine-owned arrays must be replaced through their setter/helper
model.meshInstances?.push(meshes[0]);
// @ts-expect-error hierarchy must be changed through addChild/removeChild
graphNode.children.push(entity);
// @ts-expect-error camera layers must be replaced through the setter
camera.layers.push(1);
// @ts-expect-error script order must be changed through create/destroy/move
script.scripts.push(script.scripts[0]);
// @ts-expect-error returned transform vectors are snapshots; use setters after edits
entity.getPosition().x = 1;
// @ts-expect-error layer arrays must be replaced through setters
render.layers.push(1);
// @ts-expect-error layer arrays must be replaced through setters
model.layers.push(1);
// @ts-expect-error layer arrays must be replaced through setters
cameraComponent.layers.push(1);
// @ts-expect-error layer arrays must be replaced through setters
light.layers.push(1);
// @ts-expect-error layer arrays must be replaced through setters
element.layers.push(1);
// @ts-expect-error layer arrays must be replaced through setters
sprite.layers.push(1);
// @ts-expect-error layer arrays must be replaced through setters
particles.layers.push(1);
// @ts-expect-error physics vectors must be replaced through setters
collision.halfExtents.x = 1;
// @ts-expect-error physics vectors must be replaced through setters
collision.linearOffset.x = 1;
// @ts-expect-error physics rotations must be replaced through setters
collision.angularOffset.x = 1;
// @ts-expect-error physics vectors must be replaced through setters
rigidbody.linearVelocity.x = 1;
// @ts-expect-error physics vectors must be replaced through setters
rigidbody.angularVelocity.x = 1;
// @ts-expect-error physics vectors must be replaced through setters
rigidbody.linearFactor.x = 1;
// @ts-expect-error physics vectors must be replaced through setters
rigidbody.angularFactor.x = 1;
// @ts-expect-error layout vectors must be replaced through setters
element.anchor.x = 1;
// @ts-expect-error layout vectors must be replaced through setters
element.margin.x = 1;
// @ts-expect-error layout vectors must be replaced through setters
element.pivot.x = 1;
// @ts-expect-error render colors must be replaced through setters
element.color.r = 1;
// @ts-expect-error render rects must be replaced through setters
element.rect.x = 1;
// @ts-expect-error render colors must be replaced through setters
sprite.color.r = 1;
// @ts-expect-error render colors must be replaced through setters
light.color.r = 1;
// @ts-expect-error camera rect must be replaced through the setter
cameraComponent.rect.x = 1;
// @ts-expect-error mapping must be replaced through the setter
model.mapping[0] = 1;
// @ts-expect-error slots must be changed through addSlot/removeSlot
sound.slots.player = sound.slots.player;
// @ts-expect-error animation layers must be changed through addLayer/loadStateGraph
anim.layers.push(anim.layers[0]);
// @ts-expect-error material state must be replaced through the setter
material.blendState.blend = true;
// @ts-expect-error skybox rotation must be replaced through the setter
scene.skyboxRotation.x = 1;
