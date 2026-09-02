import { expect } from 'chai';

import { ComponentSystemRegistry } from '../../../src/framework/components/registry.js';

describe('ComponentSystemRegistry', function () {

    // minimal stand-in for a ComponentSystem, as add/remove/destroy only use `id` and `destroy`
    const createSystem = id => ({
        id,
        destroyed: false,
        destroy() {
            this.destroyed = true;
        }
    });

    /** @type {ComponentSystemRegistry} */
    let registry;

    beforeEach(function () {
        registry = new ComponentSystemRegistry();
    });

    describe('#add()', function () {

        it('registers the system by id and appends it to the list', function () {
            const system = createSystem('render');

            registry.add(system);

            expect(registry.render).to.equal(system);
            expect(registry.list).to.have.ordered.members([system]);
        });

        it('throws if a system with the same id is already registered', function () {
            registry.add(createSystem('render'));

            expect(() => registry.add(createSystem('render'))).to.throw('already registered');
        });

    });

    describe('#remove()', function () {

        it('unregisters the system by id', function () {
            const system = createSystem('render');

            registry.add(system);
            registry.remove(system);

            expect(registry.render).to.be.undefined;
        });

        it('removes the system from the list', function () {
            const system = createSystem('render');

            registry.add(system);
            registry.remove(system);

            expect(registry.list).to.be.empty;
        });

        it('leaves the remaining systems registered and in order', function () {
            const render = createSystem('render');
            const light = createSystem('light');
            const camera = createSystem('camera');

            registry.add(render);
            registry.add(light);
            registry.add(camera);

            registry.remove(light);

            expect(registry.list).to.have.ordered.members([render, camera]);
            expect(registry.light).to.be.undefined;
            expect(registry.render).to.equal(render);
            expect(registry.camera).to.equal(camera);
        });

        it('throws if no system with that id is registered', function () {
            // 'render' is a declared class field, so it is an own property holding undefined
            expect(() => registry.remove(createSystem('render'))).to.throw('No ComponentSystem named');
        });

        it('throws if the id resolves to an inherited property', function () {
            // this['constructor'] is truthy, but no system is registered under it
            expect(() => registry.remove(createSystem('constructor'))).to.throw('No ComponentSystem named');
        });

    });

    describe('#destroy()', function () {

        it('destroys the registered systems', function () {
            const render = createSystem('render');

            registry.add(render);
            registry.destroy();

            expect(render.destroyed).to.be.true;
        });

        it('does not destroy a system that has been removed', function () {
            const render = createSystem('render');
            const light = createSystem('light');

            registry.add(render);
            registry.add(light);

            registry.remove(light);
            registry.destroy();

            expect(render.destroyed).to.be.true;
            expect(light.destroyed).to.be.false;
        });

    });

});
