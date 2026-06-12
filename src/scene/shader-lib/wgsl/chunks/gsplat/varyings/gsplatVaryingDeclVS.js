// Template for a user gsplat varying - vertex stage declaration, private storage and set
// function; the private value is copied to the output struct by the flush template
// Placeholders: {name}, {type}, {funcName}
export default /* wgsl */`
varying @interpolate(flat) user_{name}: {type};
var<private> _user_{name}: {type};
fn set{funcName}(value: {type}) { _user_{name} = value; }
`;
