import { HTMLCanvasElement } from '@playcanvas/canvas-mock';
import { Application } from '../../../../src/framework/application.js';
import { Entity } from '../../../../src/framework/entity.js';

import { expect } from 'chai';

import { Ammo, isOfAmmoType, allOfAmmoType } from '../../../ammo.mjs';

// Helpers

const modifiedAmmoFunctions = {};
function modifyAmmoFunction(name, fn, excludeOriginal = false) {
    // Don't override original if function was already saved.
    if (!modifiedAmmoFunctions[name]) {
        modifiedAmmoFunctions[name] = Ammo[name];
    }

    Ammo[name] = function (...args) {
        if (!excludeOriginal) {
            modifiedAmmoFunctions[name](...args);
        }

        return fn(...args);
    };
}

function restoreAmmoFunction(name) {
    if (modifiedAmmoFunctions[name]) {
        Ammo[name] = modifiedAmmoFunctions[name];
        delete modifiedAmmoFunctions[name];
    }
}

function restoreAmmoFunctions() {
    Object.keys(modifiedAmmoFunctions).forEach(f => restoreAmmoFunction(f));
}

describe('CollisionComponent', function () {
    /** @type {Application} */
    let app;

    /** @type {Entity} */
    let entity;

    // Hooks

    before(function () {
        global.Ammo = Ammo;
        app = new Application(new HTMLCanvasElement(500, 500));

        // Loading libraries. Required for Physics World to exist.
        // Using load function to avoid calling `app.start();` or
        // directly the `Application#onLibrariesLoaded` function.
        app._loadLibraries([], () => { });
    });

    after(function () {
        app.destroy();
        global.Ammo = undefined;
    });

    beforeEach(function () {
        entity = new Entity();
    });

    afterEach(function () {
        entity.destroy();
        restoreAmmoFunctions();
    });

    function checkClearCollisionShape(collision) {
        let createdShapes = 0;
        let destroyedShapes = 0;

        allOfAmmoType('btCollisionShape', true).forEach((type) => {
            modifyAmmoFunction(type, (...args) => {
                createdShapes++;
                return modifiedAmmoFunctions[type](...args);
            }, false);
        });

        modifyAmmoFunction('destroy', (obj) => {
            if (isOfAmmoType(obj, 'btCollisionShape')) {
                destroyedShapes++;
            }
        });

        if (collision.length) {
            for (let i = 0, l = collision.length; i < l; i++) {
                entity.addComponent('collision', collision[i]);
                entity.removeComponent('collision');
            }
        } else {
            entity.addComponent('collision', collision);
            entity.removeComponent('collision');
        }

        expect(createdShapes).to.equal(destroyedShapes);
    }

    it('clears box collision shape on destroy', function () {
        checkClearCollisionShape({
            type: 'box'
        });
    });

    it('clears capsule collision shape on destroy', function () {
        checkClearCollisionShape([
            {
                type: 'capsule',
                axis: 0
            }, {
                type: 'capsule',
                axis: 1
            }, {
                type: 'capsule',
                axis: 2
            }
        ]);
    });

    it('clears compound collision shape on destroy', function () {
        checkClearCollisionShape({
            type: 'compound'
        });
    });

    it('clears cone collision shape on destroy', function () {
        checkClearCollisionShape([
            {
                type: 'cone',
                axis: 0
            }, {
                type: 'cone',
                axis: 1
            }, {
                type: 'cone',
                axis: 2
            }
        ]);
    });

    it('clears cylinder collision shape on destroy', function () {
        checkClearCollisionShape([
            {
                type: 'cylinder',
                axis: 0
            }, {
                type: 'cylinder',
                axis: 1
            }, {
                type: 'cylinder',
                axis: 2
            }
        ]);
    });

    it('clears mesh collision shape on destroy', function () {
        checkClearCollisionShape({
            type: 'mesh'
        });
    });

    it('clears shape collision shape on destroy', function () {
        checkClearCollisionShape({
            type: 'sphere'
        });
    });
});
