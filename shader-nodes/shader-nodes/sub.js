import { flexOp } from './flexOp.js';

// node
var sub = {
    // placeholder meta data - structure will be finalized in MVP S3
    meta: flexOp.meta.ports,
    // placeholder editor data - structure will be finalized in MVP S3
    editor: {
        label: "SUB",
        ports: flexOp.editor.ports
    }
};

// generator
sub.gen = function ( argTypes, options ) {
    var opt = { opName: 'sub', opCode: '-' };
    Object.assign(opt, options);
    return flexOp.gen(argTypes, opt );
};

export { sub };
