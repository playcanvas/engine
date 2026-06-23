import { expect } from 'chai';

import { Component } from '../../../src/framework/components/component.js';
import { ComponentSystem } from '../../../src/framework/components/system.js';
import { Entity } from '../../../src/framework/entity.js';
import { createApp } from '../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../jsdom.mjs';

/**
 * @import { Application } from '../../../src/framework/application.js'
 */

// A legacy-style component in the mold of external plugins such as playcanvas-spine: the system
// defines a multi-property schema and a DataType, and does NOT call Component._buildAccessors at
// module level. Instead, it relies on the base Component constructor to build per-instance,
// data-backed accessors from the system's schema.
class LegacyComponent extends Component {
    onEnableCalls = 0;

    onDisableCalls = 0;

    onEnable() {
        this.onEnableCalls++;
    }

    onDisable() {
        this.onDisableCalls++;
    }
}

class LegacyComponentData {
    constructor() {
        this.enabled = true;
        this.speed = 1;
        this.label = 'default';
    }
}

class LegacyComponentSystem extends ComponentSystem {
    constructor(app) {
        super(app);

        this.id = 'legacy';

        this.ComponentType = LegacyComponent;
        this.DataType = LegacyComponentData;

        this.schema = ['enabled', 'speed', 'label'];
    }

    initializeComponentData(component, data, properties) {
        super.initializeComponentData(component, data, this.schema);
    }
}

describe('Legacy schema-based Component', function () {
    /** @type {Application} */
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
        app.systems.add(new LegacyComponentSystem(app));
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    it('builds per-instance accessors from the system schema', function () {
        const entity = new Entity();
        app.root.addChild(entity);
        entity.addComponent('legacy');

        const component = entity.legacy;

        // accessors are defined on the instance (shadowing the base prototype `enabled` accessor)
        for (const name of ['enabled', 'speed', 'label']) {
            const descriptor = Object.getOwnPropertyDescriptor(component, name);
            expect(descriptor, name).to.not.be.undefined;
            expect(descriptor.get, name).to.be.a('function');
            expect(descriptor.set, name).to.be.a('function');
        }
    });

    it('initializes properties from data defaults and supplied values', function () {
        const entity = new Entity();
        app.root.addChild(entity);
        entity.addComponent('legacy', { speed: 5 });

        const component = entity.legacy;

        expect(component.enabled).to.equal(true);
        expect(component.speed).to.equal(5);
        expect(component.label).to.equal('default');
    });

    it('stores property writes in the component data and fires set events', function () {
        const entity = new Entity();
        app.root.addChild(entity);
        entity.addComponent('legacy');

        const component = entity.legacy;

        let eventOldValue, eventNewValue;
        component.on('set_speed', (name, oldValue, newValue) => {
            eventOldValue = oldValue;
            eventNewValue = newValue;
        });

        component.speed = 7;

        expect(component.data.speed).to.equal(7);
        expect(eventOldValue).to.equal(1);
        expect(eventNewValue).to.equal(7);
    });

    it('routes enabled through the data-backed accessor and fires enable/disable', function () {
        const entity = new Entity();
        app.root.addChild(entity);
        entity.addComponent('legacy');

        const component = entity.legacy;
        expect(component.onEnableCalls).to.equal(1);

        component.enabled = false;

        expect(component.data.enabled).to.equal(false);
        expect(component.onDisableCalls).to.equal(1);

        component.enabled = true;

        expect(component.data.enabled).to.equal(true);
        expect(component.onEnableCalls).to.equal(2);
    });

    it('clones live component state via the default cloneComponent', function () {
        const entity = new Entity();
        app.root.addChild(entity);
        entity.addComponent('legacy');

        entity.legacy.speed = 9;
        entity.legacy.label = 'cloned';
        entity.legacy.enabled = false;

        const clone = entity.clone();
        app.root.addChild(clone);

        expect(clone.legacy.speed).to.equal(9);
        expect(clone.legacy.label).to.equal('cloned');
        expect(clone.legacy.enabled).to.equal(false);
    });
});
