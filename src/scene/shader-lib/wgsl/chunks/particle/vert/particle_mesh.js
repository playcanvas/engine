export default /* wgsl */`
var localPos = meshLocalPos;
let rotResultXY = rotateWithMatrix(localPos.xy, inAngle);
localPos = vec3f(rotResultXY.rotatedVec, localPos.z);
rotMatrix = rotResultXY.matrix;

let rotResultYZ = rotateWithMatrix(localPos.yz, inAngle);
localPos = vec3f(localPos.x, rotResultYZ.rotatedVec);
rotMatrix = rotResultYZ.matrix;

billboard(particlePos, quadXY);
`;
