import flexOp from './flexOp.js';

// node
var mul = {
    meta: { label: "MUL" }
};

// ports
mul.meta.ports = flexOp.meta.ports;

// generator
mul.gen = function ( argTypes ) {
    return flexOp.gen( argTypes, { opName: 'mul', opCode: '*' } );
};

// export { mul };
export default mul;
