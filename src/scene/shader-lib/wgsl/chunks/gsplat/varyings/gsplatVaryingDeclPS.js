// Template for a user gsplat varying - fragment stage declaration and get function
// Placeholders: {name}, {type}, {funcName}
export default /* wgsl */`
varying @interpolate(flat, either) user_{name}: {type};
fn get{funcName}() -> {type} { return user_{name}; }
`;
