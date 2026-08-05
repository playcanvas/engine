// Template for a user gsplat varying - vertex stage declaration and set function
// Placeholders: {name}, {type}, {funcName}
export default /* glsl */`
flat varying {type} user_{name};
void set{funcName}({type} value) { user_{name} = value; }
`;
