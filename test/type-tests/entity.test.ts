// Consumer-side type tests for Entity#addComponent, Entity#findComponent, Entity#findComponents
// and Entity#removeComponent. Compiled by `npm run test:types` against build/playcanvas.d.ts, so
// they exercise exactly what an application sees.
import {
    Asset, CameraComponent, CollisionComponent, Color, Component, ElementComponent, Entity,
    LightComponent, RenderComponent, ScriptComponent, Vec3
} from '../../build/playcanvas.js';
import type { ComponentMap, ComponentOptions } from '../../build/playcanvas.js';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

// An application-defined component: declaring its property on Entity is the one augmentation
// needed to type it everywhere.
class MyComponent extends Component {
    set speed(value: number) {}

    get speed(): number {
        return 1;
    }
}
declare module '../../build/playcanvas.js' {
    interface Entity {
        readonly mything: MyComponent | undefined;
    }
}

const entity = new Entity();
const name: string = 'camera';

// ---- built-in components: the name types both the options and the result
const camera = entity.addComponent('camera', { fov: 45, clearColor: new Color(1, 0, 0), enabled: false });
type T1 = Expect<Equal<typeof camera, CameraComponent | null>>;
const light = entity.addComponent('light');
type T2 = Expect<Equal<typeof light, LightComponent | null>>;
const script = entity.addComponent('script', { order: ['a'], scripts: { a: { enabled: true, attributes: {} } } });
type T3 = Expect<Equal<typeof script, ScriptComponent | null>>;
const element = entity.addComponent('element', {
    type: 'image', anchor: [0, 0, 1, 1], pivot: [0.5, 0.5], textureAsset: new Asset('a', 'texture')
});
type T4 = Expect<Equal<typeof element, ElementComponent | null>>;
const render = entity.addComponent('render', {
    type: 'box', aabbCenter: [0, 0, 0], aabbHalfExtents: [1, 1, 1], batchGroupId: null
});
type T5 = Expect<Equal<typeof render, RenderComponent | null>>;
const collision = entity.addComponent('collision', {
    type: 'box', halfExtents: [1, 1, 1], linearOffset: new Vec3(), angularOffset: [0, 90, 0]
});
type T6 = Expect<Equal<typeof collision, CollisionComponent | null>>;

// ---- system-level overrides: callbacks, array forms, deprecated aliases and plain data
entity.addComponent('camera', { calculateTransform: (transform, view) => {}, clearColor: [0, 0, 0, 1], rect: [0, 0, 1, 1] });
entity.addComponent('light', { enable: true, color: [1, 1, 1], cookieOffset: [0, 0] });
entity.addComponent('particlesystem', {
    emitterExtents: [1, 1, 1], alphaGraph: { type: 1, keys: [0, 1, 1, 0] }, colorGraph: { keys: [[0, 1], [0, 1], [0, 1]] }, mesh: 12
});
entity.addComponent('sprite', { color: [1, 1, 1], clips: { idle: { fps: 10, loop: true, spriteAsset: 3 } } });
entity.addComponent('sound', { slots: { fire: { asset: 4, volume: 0.5 } } });
entity.addComponent('rigidbody', { type: 'dynamic', linearFactor: [1, 0, 1] });
entity.addComponent('screen', { resolution: [1280, 720], screenSpace: true });
entity.addComponent('layoutgroup', { spacing: [4, 4], padding: [0, 0, 0, 0] });
entity.addComponent('button', { hitPadding: [0, 0, 0, 0] });
entity.addComponent('scrollview', { mouseWheelSensitivity: [1, 1] });
entity.addComponent('anim', { layers: [{ name: 'Base' }], masks: { Base: { mask: {} } } });

// ---- rejected options
// @ts-expect-error typo
entity.addComponent('camera', { fovv: 45 });
// @ts-expect-error wrong value type
entity.addComponent('camera', { fov: 'wide' });
// @ts-expect-error getter-only property
entity.addComponent('camera', { frustum: null });
// @ts-expect-error method
entity.addComponent('camera', { screenToWorld: () => new Vec3() });
// @ts-expect-error callback the system does not consume
entity.addComponent('camera', { onPostprocessing: () => {} });
// @ts-expect-error underscore-prefixed internal
entity.addComponent('element', { _anchorDirty: true });
// @ts-expect-error base-class reference
entity.addComponent('camera', { entity });
// @ts-expect-error inherited method
entity.addComponent('light', { fire: () => {} });
// @ts-expect-error option of a different component
entity.addComponent('light', { fov: 45 });
// @ts-expect-error no array form where the system passes the value straight to the property
entity.addComponent('element', { outlineColor: [0, 0, 0] });

// ---- a non-literal name, or a name that is not in ComponentMap, keeps the loose signature
const loose = entity.addComponent(name, { anything: 1 });
type T7 = Expect<Equal<typeof loose, Component | null>>;
const unknown = entity.addComponent('unregistered', { foo: 1 });
type T8 = Expect<Equal<typeof unknown, Component | null>>;

// ---- application-defined component, after the augmentation above
const mine = entity.addComponent('mything', { speed: 3 });
type T9 = Expect<Equal<typeof mine, MyComponent | null>>;
// @ts-expect-error typo in an option of an application-defined component
entity.addComponent('mything', { sped: 3 });
type T10 = Expect<Equal<ComponentMap['mything'], MyComponent>>;

// ---- the public types can be named
type T11 = Expect<Equal<ComponentMap['camera'], CameraComponent>>;
const options: ComponentOptions<'camera'> = { fov: 30, clearColor: [0, 0, 0, 1] };
entity.addComponent('camera', options);
type T12 = Expect<Equal<ComponentOptions<'light'>['enable'], boolean | undefined>>;
type T13 = Expect<Equal<ComponentOptions<'mything'>['speed'], number | undefined>>;

// ---- findComponent, findComponents and removeComponent follow ComponentMap
const found = entity.findComponent('light');
type T14 = Expect<Equal<typeof found, LightComponent | null>>;
const all = entity.findComponents('mything');
type T15 = Expect<Equal<typeof all, MyComponent[]>>;
const anyFound = entity.findComponent(name);
type T16 = Expect<Equal<typeof anyFound, Component | null>>;
entity.removeComponent('camera');
entity.removeComponent(name);

export type Checks = [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15, T16];
