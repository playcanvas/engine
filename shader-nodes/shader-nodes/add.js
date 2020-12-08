import { flexOp } from "./flexOp";

// node
var add = {
    // placeholder meta data - structure will be finalized in MVP S3
    meta: flexOp.meta.ports,
    // placeholder editor data - structure will be finalized in MVP S3
    editor: {
        label: "ADD",
        ports: flexOp.editor.ports
    }
};

// generator
add.gen = function ( argTypes, options ) {
    var opt = { opName: 'add', opCode: '+' };
    Object.assign(opt, options);
    return flexOp.gen(argTypes, opt );
};

// export { add };
export default add;
