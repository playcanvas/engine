import { expect } from 'chai';

import { Entity } from '../../../src/framework/entity.js';
import { createScript, registerScript } from '../../../src/framework/script/script-create.js';
import { Script } from '../../../src/framework/script/script.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

describe('ScriptRegistry', function () {

    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('#add', function () {

        it('registers an ESM Script under its static scriptName', function () {
            class EsmScript extends Script {
                static scriptName = 'esmScript';
            }

            const added = app.scripts.add(EsmScript);

            expect(added).to.equal(true);
            expect(app.scripts.has('esmScript')).to.equal(true);
            expect(app.scripts.get('esmScript')).to.equal(EsmScript);
            // the resolved name is persisted on the class
            expect(EsmScript.__name).to.equal('esmScript');
        });

        it('allows an ESM Script added by name to be created on an entity by name', function () {
            class Rotator extends Script {
                static scriptName = 'rotator';
            }
            app.scripts.add(Rotator);

            const e = new Entity();
            e.addComponent('script');
            const instance = e.script.create('rotator');

            expect(instance).to.be.an.instanceof(Rotator);
            expect(e.script.has('rotator')).to.equal(true);
        });

        it('registers a ScriptType under its name', function () {
            const Mover = createScript('mover');
            // createScript already adds it; ensure it is retrievable by name
            expect(app.scripts.has('mover')).to.equal(true);
            expect(app.scripts.get('mover')).to.equal(Mover);
        });

        it('does not register a script that has no resolvable name', function () {
            // an anonymous class with neither scriptName nor an inferable name
            const Anonymous = (() => class extends Script {})();
            Object.defineProperty(Anonymous, 'name', { value: '' });

            const added = app.scripts.add(Anonymous);

            expect(added).to.equal(false);
        });

        it('registerScript fails fast (no throw, not registered) when no name can be resolved', function () {
            // an anonymous class with neither scriptName nor an inferable name
            const Anonymous = (() => class extends Script {})();
            Object.defineProperty(Anonymous, 'name', { value: '' });

            const before = app.scripts.list().length;
            expect(() => registerScript(Anonymous, undefined, app)).to.not.throw();

            expect(Anonymous.__name == null).to.equal(true);
            expect(app.scripts.list().length).to.equal(before);
        });

        it('registerScript and direct add resolve to the same name', function () {
            class ViaRegister extends Script {
                static scriptName = 'viaRegister';
            }
            registerScript(ViaRegister, undefined, app);

            expect(app.scripts.has('viaRegister')).to.equal(true);
            expect(app.scripts.get('viaRegister')).to.equal(ViaRegister);
        });

        it('safely handles script names that collide with Object.prototype members', function () {
            const names = ['hasOwnProperty', 'toString', 'constructor', '__proto__', 'valueOf'];
            const classes = names.map((name) => {
                class Collider extends Script {}
                Collider.scriptName = name;
                return Collider;
            });

            classes.forEach((cls, i) => {
                expect(app.scripts.add(cls), names[i]).to.equal(true);
            });

            // each is stored and retrievable by its (collision-prone) name
            names.forEach((name, i) => {
                expect(app.scripts.has(name), name).to.equal(true);
                expect(app.scripts.get(name), name).to.equal(classes[i]);
            });

            // and they all appear in the list without clobbering each other
            names.forEach((name, i) => {
                expect(app.scripts.list().includes(classes[i]), name).to.equal(true);
            });
        });

        it('rejects a reserved script name via add()', function () {
            class Reserved extends Script {
                static scriptName = 'destroy';
            }

            const added = app.scripts.add(Reserved);

            expect(added).to.equal(false);
            expect(app.scripts.has('destroy')).to.equal(false);
        });

    });

    // a subclass must register under its own name, not inherit (and overwrite) its base's name
    describe('#add subclassing', function () {

        it('a subclass with its own scriptName does not overwrite its base (registerScript)', function () {
            class Base extends Script {
                static scriptName = 'baseScript';
            }
            class Derived extends Base {
                static scriptName = 'derivedScript';
            }

            registerScript(Base, undefined, app);
            registerScript(Derived, undefined, app);

            expect(app.scripts.has('baseScript')).to.equal(true);
            expect(app.scripts.has('derivedScript')).to.equal(true);
            expect(app.scripts.get('baseScript')).to.equal(Base);
            expect(app.scripts.get('derivedScript')).to.equal(Derived);
            expect(Base.__name).to.equal('baseScript');
            expect(Derived.__name).to.equal('derivedScript');
        });

        it('a subclass with its own scriptName does not overwrite its base (add)', function () {
            class Base extends Script {
                static scriptName = 'baseScript2';
            }
            class Derived extends Base {
                static scriptName = 'derivedScript2';
            }

            app.scripts.add(Base);
            app.scripts.add(Derived);

            expect(app.scripts.get('baseScript2')).to.equal(Base);
            expect(app.scripts.get('derivedScript2')).to.equal(Derived);
        });

        it('a subclass without an explicit name registers under its own (verbatim) class name', function () {
            class ParentScript extends Script {}
            class ChildScript extends ParentScript {}

            registerScript(ParentScript, undefined, app);
            registerScript(ChildScript, undefined, app);

            // registerScript falls back to the verbatim class name; each subclass uses its own name
            // and never inherits (and overwrites) its base's
            expect(app.scripts.get('ParentScript')).to.equal(ParentScript);
            expect(app.scripts.get('ChildScript')).to.equal(ChildScript);
            expect(ParentScript.__name).to.equal('ParentScript');
            expect(ChildScript.__name).to.equal('ChildScript');
        });

        it('registers a nameless script via registerScript under its verbatim class name', function () {
            class FreeScript extends Script {}
            registerScript(FreeScript, undefined, app);

            // registerScript uses the verbatim class name (pre-2.19.3 behaviour), so projects that
            // reference the script by its class name keep resolving it
            expect(FreeScript.__name).to.equal('FreeScript');
            expect(app.scripts.has('FreeScript')).to.equal(true);
            expect(app.scripts.get('FreeScript')).to.equal(FreeScript);
            expect(app.scripts.has('freeScript')).to.equal(false);
        });

        it('attaches a script referenced by its class name after a nameless registerScript', function () {
            // the pre-2.19.3 pattern that regressed in 2.19.3: register an ES6 class with no
            // explicit name, then reference it on an entity by its (verbatim) class name
            class PlayerController extends Script {}
            registerScript(PlayerController, undefined, app);

            const e = new Entity();
            app.root.addChild(e);
            e.addComponent('script');

            const instance = e.script.create('PlayerController');
            expect(instance).to.be.an.instanceof(PlayerController);
            expect(e.script.PlayerController).to.equal(instance);
        });

        it('an explicit name passed to registerScript still wins for a subclass', function () {
            class Base extends Script {
                static scriptName = 'baseExplicit';
            }
            class Derived extends Base {}

            registerScript(Base, undefined, app);
            registerScript(Derived, 'derivedExplicit', app);

            expect(app.scripts.get('baseExplicit')).to.equal(Base);
            expect(app.scripts.get('derivedExplicit')).to.equal(Derived);
        });

    });

});
