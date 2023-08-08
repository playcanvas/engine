import { Application } from '../../../src/framework/application.js';
import { Color } from '../../../src/core/math/color.js';
import { ComponentSystem } from '../../../src/framework/components/system.js';
import { Vec2 } from '../../../src/core/math/vec2.js';
import { Vec3 } from '../../../src/core/math/vec3.js';
import { Vec4 } from '../../../src/core/math/vec4.js';

import { HTMLCanvasElement } from '@playcanvas/canvas-mock';

import { expect } from 'chai';

describe('ComponentSystem', function () {
    /** @type {Application} */
    let app;
    /** @type {ComponentSystem} */
    let system;

    beforeEach(function () {
        const canvas = new HTMLCanvasElement(500, 500);
        app = new Application(canvas);

        system = new ComponentSystem(app);
    });

    afterEach(function () {
        app.destroy();
    });

    describe('#initializeComponentData()', function () {

        it('works with a flat list of property names', function () {
            const component = {};
            const data = {
                foo: 42,
                bar: 84
            };
            const properties = ['foo', 'bar'];

            system.initializeComponentData(component, data, properties);

            expect(component.foo).to.equal(42);
            expect(component.bar).to.equal(84);
        });

        it('works with a list of property descriptor objects', function () {
            const component = {};
            const data = {
                rgbProperty: new Color(1, 2, 3),
                rgbaProperty: new Color(1, 2, 3, 4),
                vec2Property: new Vec2(1, 2),
                vec3Property: new Vec3(1, 2, 3),
                vec4Property: new Vec4(1, 2, 3, 4),
                booleanProperty: true,
                numberProperty: 42,
                stringProperty: 'foo',
                entityProperty: 'abcde-12345'
            };
            const properties = [
                { name: 'rgbProperty', type: 'rgb' },
                { name: 'rgbaProperty', type: 'rgba' },
                { name: 'vec2Property', type: 'vec2' },
                { name: 'vec3Property', type: 'vec3' },
                { name: 'vec4Property', type: 'vec4' },
                { name: 'booleanProperty', type: 'boolean' },
                { name: 'numberProperty', type: 'number' },
                { name: 'stringProperty', type: 'string' },
                { name: 'entityProperty', type: 'entity' }
            ];

            system.initializeComponentData(component, data, properties);

            expect(component.rgbProperty.r).to.equal(1);
            expect(component.rgbProperty.g).to.equal(2);
            expect(component.rgbProperty.b).to.equal(3);
            expect(component.rgbProperty).to.not.equal(data.rgbProperty); // Ensure a copy has been created

            expect(component.rgbaProperty.r).to.equal(1);
            expect(component.rgbaProperty.g).to.equal(2);
            expect(component.rgbaProperty.b).to.equal(3);
            expect(component.rgbaProperty.a).to.equal(4);
            expect(component.rgbaProperty).to.not.equal(data.rgbaProperty);

            expect(component.vec2Property.x).to.equal(1);
            expect(component.vec2Property.y).to.equal(2);
            expect(component.vec2Property).to.not.equal(data.vec2Property);

            expect(component.vec3Property.x).to.equal(1);
            expect(component.vec3Property.y).to.equal(2);
            expect(component.vec3Property.z).to.equal(3);
            expect(component.vec3Property).to.not.equal(data.vec3Property);

            expect(component.vec4Property.x).to.equal(1);
            expect(component.vec4Property.y).to.equal(2);
            expect(component.vec4Property.z).to.equal(3);
            expect(component.vec4Property.w).to.equal(4);
            expect(component.vec4Property).to.not.equal(data.vec4Property);

            expect(component.booleanProperty).to.equal(true);
            expect(component.numberProperty).to.equal(42);
            expect(component.stringProperty).to.equal('foo');
            expect(component.entityProperty).to.equal('abcde-12345');
        });

        it('handles nulls', function () {
            const component = {};
            const data = {
                rgbProperty: null,
                rgbaProperty: null,
                vec2Property: null,
                vec3Property: null,
                vec4Property: null,
                booleanProperty: null,
                numberProperty: null,
                stringProperty: null,
                entityProperty: null
            };
            const properties = [
                { name: 'rgbProperty', type: 'rgb' },
                { name: 'rgbaProperty', type: 'rgba' },
                { name: 'vec2Property', type: 'vec2' },
                { name: 'vec3Property', type: 'vec3' },
                { name: 'vec4Property', type: 'vec4' },
                { name: 'booleanProperty', type: 'boolean' },
                { name: 'numberProperty', type: 'number' },
                { name: 'stringProperty', type: 'string' },
                { name: 'entityProperty', type: 'string' }
            ];

            system.initializeComponentData(component, data, properties);

            expect(component.rgbProperty).to.be.null;
            expect(component.rgbaProperty).to.be.null;
            expect(component.vec2Property).to.be.null;
            expect(component.vec3Property).to.be.null;
            expect(component.vec4Property).to.be.null;
            expect(component.booleanProperty).to.be.null;
            expect(component.numberProperty).to.be.null;
            expect(component.stringProperty).to.be.null;
            expect(component.entityProperty).to.be.null;
        });

        it('handles vec values being delivered as arrays', function () {
            const component = {};
            const data = {
                rgbProperty: [1, 2, 3],
                vec4Property: [1, 2, 3, 4]
            };
            const properties = [
                { name: 'rgbProperty', type: 'rgb' },
                { name: 'vec4Property', type: 'vec4' }
            ];

            system.initializeComponentData(component, data, properties);

            expect(component.rgbProperty.r).to.equal(1);
            expect(component.rgbProperty.g).to.equal(2);
            expect(component.rgbProperty.b).to.equal(3);
            expect(component.rgbProperty).to.not.equal(data.rgbProperty);

            expect(component.vec4Property.x).to.equal(1);
            expect(component.vec4Property.y).to.equal(2);
            expect(component.vec4Property.z).to.equal(3);
            expect(component.vec4Property.w).to.equal(4);
            expect(component.vec4Property).to.not.equal(data.vec4Property);
        });

        it('works if a normal value comes after an object value', function () {
            const component = {};
            const data = {
                vec: [1, 2, 3, 4],
                num: 42
            };
            const properties = [
                { name: 'vec', type: 'vec4' },
                'num'
            ];

            system.initializeComponentData(component, data, properties);

            expect(component.vec.x).to.equal(1);
            expect(component.vec.y).to.equal(2);
            expect(component.vec.z).to.equal(3);
            expect(component.vec.w).to.equal(4);
            expect(component.num).to.equal(42);
        });

        it('throws if provided an unknown type', function () {
            const component = {};
            const data = {
                foo: 42
            };
            const properties = [
                { name: 'foo', type: 'something' }
            ];

            expect(function () {
                system.initializeComponentData(component, data, properties);
            }).to.throw('Could not convert unhandled type: something');
        });

    });

    describe('#getPropertiesOfType()', function () {

        it('returns properties of the specified type', function () {
            system.schema = [
                { name: 'foo', type: 'typeA' },
                { name: 'bar', type: 'typeA' },
                { name: 'baz', type: 'typeB' },
                'bob'
            ];

            expect(system.getPropertiesOfType('typeA')).to.deep.equal([
                { name: 'foo', type: 'typeA' },
                { name: 'bar', type: 'typeA' }
            ]);
        });

        it('returns an empty array if no properties match the specified type', function () {
            system.schema = [
                { name: 'foo', type: 'typeA' },
                { name: 'bar', type: 'typeA' },
                { name: 'baz', type: 'typeB' },
                'bob'
            ];

            expect(system.getPropertiesOfType('typeC')).to.deep.equal([]);
        });

        it('doesn\'t throw an error if the system doesn\'t have a schema', function () {
            system.schema = null;

            expect(system.getPropertiesOfType('typeA')).to.deep.equal([]);
        });

    });

});
