// Consumer-side type tests for the script lookup APIs: Entity#findScript, Entity#findScripts,
// ScriptComponent#get, ScriptComponent#create and ScriptRegistry#get. Compiled by
// `npm run test:types` against build/playcanvas.d.ts, so they exercise exactly what an
// application sees.
import { Entity, Script, ScriptType, createScript } from '../../build/playcanvas.js';
import type { AppBase } from '../../build/playcanvas.js';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

// A modern application script. It does not extend the deprecated ScriptType.
class PlayerController extends Script {
    static scriptName = 'playerController';

    speed = 1;
}

// A legacy script created with createScript. The registry may already hold the name, so the
// result is nullable.
const Legacy = createScript('legacy')!;

declare const app: AppBase;
const entity = new Entity();
const script = entity.addComponent('script')!;
const name: string = 'playerController';

// ---- passing the class types the result as that class, so no cast is needed
const found = entity.findScript(PlayerController);
type T1 = Expect<Equal<typeof found, PlayerController | undefined>>;
const foundAll = entity.findScripts(PlayerController);
type T2 = Expect<Equal<typeof foundAll, PlayerController[]>>;
const got = script.get(PlayerController);
type T3 = Expect<Equal<typeof got, PlayerController | null>>;
const created = script.create(PlayerController, { properties: { speed: 4 } });
type T4 = Expect<Equal<typeof created, PlayerController | null>>;
found?.speed;
created?.speed;

// ---- passing a name returns the Script base class
const byName = entity.findScript(name);
type T5 = Expect<Equal<typeof byName, Script | undefined>>;
const allByName = entity.findScripts('playerController');
type T6 = Expect<Equal<typeof allByName, Script[]>>;
const gotByName = script.get('playerController');
type T7 = Expect<Equal<typeof gotByName, Script | null>>;
const createdByName = script.create('playerController', { attributes: { speed: 4 } });
type T8 = Expect<Equal<typeof createdByName, Script | null>>;

// ---- a result found by name can be narrowed to a Script subclass with a cast
const cast = entity.findScript('playerController') as PlayerController;
cast.speed;
const castGot = script.get('playerController') as PlayerController | null;
castGot?.speed;

// ---- legacy ScriptType classes still work and keep their own type
const legacy = script.get(Legacy);
type T9 = Expect<Equal<typeof legacy, ScriptType | null>>;
const legacyFound = entity.findScript(Legacy);
type T10 = Expect<Equal<typeof legacyFound, ScriptType | undefined>>;

// ---- the other lookups accept either form
script.has(PlayerController);
script.has('playerController');
script.destroy(PlayerController);
script.destroy(Legacy);
script.move(PlayerController, 0);
entity.findScripts(Legacy);

// ---- the scripts array and the registry are typed as Script, not ScriptType
const scripts: ReadonlyArray<Script> = script.scripts;
scripts.length;
const registered = app.scripts.get('playerController');
type T11 = Expect<Equal<typeof registered, typeof Script | null>>;
app.scripts.add(PlayerController);
app.scripts.add(Legacy);
app.scripts.has(PlayerController);
app.scripts.remove(PlayerController);
const list: Array<typeof Script> = app.scripts.list();
list.length;

// ---- rejected arguments
class NotAScript {
    speed = 1;
}
// @ts-expect-error a class that does not extend Script
entity.findScript(NotAScript);
// @ts-expect-error a class that does not extend Script
script.get(NotAScript);
// @ts-expect-error a class that does not extend Script
script.create(NotAScript);
// @ts-expect-error an unrelated value
script.has(42);

export type Checks = [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11];
