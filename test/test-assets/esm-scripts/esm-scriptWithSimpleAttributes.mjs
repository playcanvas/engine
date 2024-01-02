import { Color } from '../../../src/core/math/color.js';

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
    },

    colorAttribute: {
        type: 'rgba',
        default: new Color(1, 1, 1, 1)
    }
};

export default class ScriptWithSimpleAttributes {
    static attributes = attributes;
}
