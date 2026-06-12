// Template for a user gsplat varying - fragment stage declaration and get function
// Placeholders: {name}, {type}, {funcName}
export default /* glsl */`
flat varying {type} user_{name};
{type} get{funcName}() { return user_{name}; }
`;
