export default /* wgsl */`
    var negNormal: vec3f = max(normal, vec3(0.0));
    var posNormal: vec3f = max(-normal, vec3(0.0));
`;
