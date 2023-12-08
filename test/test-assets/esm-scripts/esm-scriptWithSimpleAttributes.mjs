const attributes = {

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
    }
};

export default class ScriptWithSimpleAttributes {
    static attributes = attributes;
}
