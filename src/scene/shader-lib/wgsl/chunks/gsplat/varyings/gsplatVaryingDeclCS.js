// Template for a user gsplat varying - compute projector private storage and set function
// (no varyings in compute, the value is written to the projection cache instead)
// Placeholders: {name}, {type}, {funcName}
export default /* wgsl */`
var<private> _user_{name}: {type};
fn set{funcName}(value: {type}) { _user_{name} = value; }
`;
