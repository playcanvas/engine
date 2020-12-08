import flexOp from './flexOp.js';

// node
var mul = {
    // placeholder meta data - structure will be finalized in MVP S3
    meta: flexOp.meta.ports,
    // placeholder editor data - structure will be finalized in MVP S3
    editor: {
        label: "MUL",
        ports: flexOp.editor.ports
    }
};

// generator
mul.gen = function ( argTypes, options ) {
    var opt = { opName: 'mul', opCode: '*' };
    Object.assign(opt, options);
    return flexOp.gen(argTypes, opt );
};

// export { mul };
export default mul;
