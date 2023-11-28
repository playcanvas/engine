const CustomType = {
    internalNumberNoDefault: { type: 'number' },
    internalNumber: { type: 'number', default: 1 },

    internalArrayNoDefault: { type: 'number', array: true },
    internalArray: { type: 'number', array: true, default: [1, 2, 3, 4] },

    internalColorNoDefault: { type: 'rgba' },
    internalColor: { type: 'rgba', default: [1, 1, 1, 1] },
    // internalColor: { type: 'rgb', default: '#ff0000' },

    invalidAttribute: 'This is an invalid attribute',
    invalidAttributeType: { type: 'This is an invalid type' }

    // fieldNumberArray: { type: 'number', default: 5 }
};

export const attributes = {

    invalidAttribute: 'Should Raise A Warning/Error',
    invalidAttributeType: { type: 'An invalid attribute type' },
    invalidAttributeTypeWithDefault: { type: 'An invalid attribute type', default: 'wrong' },
    invalidAttributeTypeArray: { type: 'An invalid attribute type', array: true },

    simpleAttributeNoDefault: {
        type: 'number'
    },

    simpleAttributeWithFalsyDefault: {
        type: 'boolean',
        default: false
    },

    simpleAttribute: {
        type: 'number',
        default: 10
    },

    simpleColorHex: {
        type: 'rgb',
        default: '#ff0000'
    },

    simpleColorAsArray: {
        type: 'rgb',
        default: [1, 2, 3, 4]
    },

    simpleAttributeArray: {
        type: 'number',
        default: [10],
        array: true
    },

    simpleAttributeArrayInvalidDefault: {
        type: 'number',
        default: 10,
        array: true
    },

    simpleAttributeArrayNoDefault: {
        type: 'number',
        array: true
    },

    simpleAttributeArrayWithDefaultArray: {
        type: 'number',
        default: [10, 20, 30],
        array: true
    },

    complexAttributeNoDefault: {
        type: CustomType
    },

    complexAttribute: {
        type: CustomType,
        default: {
            internalNumberNoDefault: 10,
            internalArray: [6, 7, 8, 9],
            nonExistent: 22
        }
    },

    attribute1: { type: 'entity' },
    attribute2: { type: 'number', default: 2 },
    // attribute3: SomeType,

    // attribute4: {
    //     title: 'asdqasw',
    //     description: 'hello',
    //     type: SomeType,
    // },

    // attribute5: {
    //     title: 'asdqasw',
    //     description: 'hello',
    //     type: SomeType,
    //     array: true
    // }

    // Any item with a 'type' property becomes editable in the editor,
    // if it has 'array' boolean that's true, it will become an array of multiple values of 'type,
    // if it's a plain object, it becomes a folder
    // anything else is ignored

    // what if it has a schema

    // attribute5: {
    //     type: schema,
    //     default: {
        // }
        // schema: {sdff}
        // array: true,
        // default: []
        // array: true
        // default: {
        //     fieldNumber: 10,
        //     fieldEntity: 10
        // }
    // }
};

export default class ScriptWithAttributes {

}
