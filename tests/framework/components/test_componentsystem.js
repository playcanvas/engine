module("pc.ComponentSystem", {
    setup: function () {
        this.app = new pc.Application(document.createElement("canvas"));
        this.system = new pc.ComponentSystem(this.app);
    },

    teardown: function () {
        this.app.destroy();
    }
});

test("initializeComponentData() works with a flat list of property names", function () {
    var component = {};
    var data = {
        foo: 42,
        bar: 84
    };
    var properties = ['foo', 'bar'];

    this.system.initializeComponentData(component, data, properties);

    strictEqual(component.foo, 42);
    strictEqual(component.bar, 84);
});

test("initializeComponentData() works with a list of property descriptor objects", function () {
    var component = {};
    var data = {
        rgbProperty: new pc.Color(1, 2, 3),
        rgbaProperty: new pc.Color(1, 2, 3, 4),
        vec2Property: new pc.Vec2(1, 2),
        vec3Property: new pc.Vec3(1, 2, 3),
        vec4Property: new pc.Vec4(1, 2, 3, 4),
        booleanProperty: true,
        numberProperty: 42,
        stringProperty: 'foo',
        entityProperty: 'abcde-12345'
    };
    var properties = [
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

    this.system.initializeComponentData(component, data, properties);

    strictEqual(component.rgbProperty.r, 1);
    strictEqual(component.rgbProperty.g, 2);
    strictEqual(component.rgbProperty.b, 3);
    notEqual(component.rgbProperty, data.rgbProperty); // Ensure a copy has been created

    strictEqual(component.rgbaProperty.r, 1);
    strictEqual(component.rgbaProperty.g, 2);
    strictEqual(component.rgbaProperty.b, 3);
    strictEqual(component.rgbaProperty.a, 4);
    notEqual(component.rgbaProperty, data.rgbaProperty);

    strictEqual(component.vec2Property.x, 1);
    strictEqual(component.vec2Property.y, 2);
    notEqual(component.vec2Property, data.vec2Property);

    strictEqual(component.vec3Property.x, 1);
    strictEqual(component.vec3Property.y, 2);
    strictEqual(component.vec3Property.z, 3);
    notEqual(component.vec3Property, data.vec3Property);

    strictEqual(component.vec4Property.x, 1);
    strictEqual(component.vec4Property.y, 2);
    strictEqual(component.vec4Property.z, 3);
    strictEqual(component.vec4Property.w, 4);
    notEqual(component.vec4Property, data.vec4Property);

    strictEqual(component.booleanProperty, true);
    strictEqual(component.numberProperty, 42);
    strictEqual(component.stringProperty, 'foo');
    strictEqual(component.entityProperty, 'abcde-12345');
});

test("initializeComponentData() handles nulls", function () {
    var component = {};
    var data = {
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
    var properties = [
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

    this.system.initializeComponentData(component, data, properties);

    strictEqual(component.rgbProperty, null);
    strictEqual(component.rgbaProperty, null);
    strictEqual(component.vec2Property, null);
    strictEqual(component.vec3Property, null);
    strictEqual(component.vec4Property, null);
    strictEqual(component.booleanProperty, null);
    strictEqual(component.numberProperty, null);
    strictEqual(component.stringProperty, null);
    strictEqual(component.entityProperty, null);
});

test("initializeComponentData() handles vec values being delivered as arrays", function () {
    var component = {};
    var data = {
        rgbProperty: [1, 2, 3],
        vec4Property: [1, 2, 3, 4]
    };
    var properties = [
        { name: 'rgbProperty', type: 'rgb' },
        { name: 'vec4Property', type: 'vec4' }
    ];

    this.system.initializeComponentData(component, data, properties);

    strictEqual(component.rgbProperty.r, 1);
    strictEqual(component.rgbProperty.g, 2);
    strictEqual(component.rgbProperty.b, 3);
    notEqual(component.rgbProperty, data.rgbProperty);

    strictEqual(component.vec4Property.x, 1);
    strictEqual(component.vec4Property.y, 2);
    strictEqual(component.vec4Property.z, 3);
    strictEqual(component.vec4Property.w, 4);
    notEqual(component.vec4Property, data.vec4Property);
});

test("initializeComponentData() throws if provided an unknown type", function () {
    var component = {};
    var data = {
        foo: 42
    };
    var properties = [
        { name: 'foo', type: 'something' }
    ];

    throws(function() {
        this.system.initializeComponentData(component, data, properties);
    }, 'Could not convert unhandled type: something');
});

test("getPropertiesOfType() returns properties of the specified type", function () {
    this.system.schema = [
        { name: 'foo', type: 'typeA' },
        { name: 'bar', type: 'typeA' },
        { name: 'baz', type: 'typeB' },
        'bob'
    ];

    deepEqual(this.system.getPropertiesOfType('typeA'), [
        { name: 'foo', type: 'typeA' },
        { name: 'bar', type: 'typeA' }
    ]);
});

test("getPropertiesOfType() returns an empty array if no properties match the specified type", function () {
    this.system.schema = [
        { name: 'foo', type: 'typeA' },
        { name: 'bar', type: 'typeA' },
        { name: 'baz', type: 'typeB' },
        'bob'
    ];

    deepEqual(this.system.getPropertiesOfType('typeC'), []);
});

test("getPropertiesOfType() doesn't throw an error if the system doesn't have a schema", function () {
    this.system.schema = null;

    deepEqual(this.system.getPropertiesOfType('typeA'), []);
});
