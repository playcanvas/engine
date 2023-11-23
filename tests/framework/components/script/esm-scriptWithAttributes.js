export const attributes = {
    attribute1: { type: 'entity' },
    attribute2: { type: 'number', default: 2 },
    attribute3: {
        fieldNumber: { type: 'number', default: 1 },
        fieldEntity: { type: 'entity' },
        fieldNumberArray: { type: 'number', array: true, default: 5 }
    }
};

export default class ScriptWithAttributes {

}
