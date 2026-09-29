import { Vec3 } from '../../core/math/vec3.js';
import { Geometry } from './geometry.js';

const primitiveUv1Padding = 8.0 / 64;
const primitiveUv1PaddingScale = 1.0 - primitiveUv1Padding * 2;

/**
 * Shared superclass of {@link CapsuleGeometry}, {@link ConeGeometry} and {@link CylinderGeometry}.
 * Use those classes instead of this one.
 *
 * @category Graphics
 */
class ConeBaseGeometry extends Geometry {
    constructor(baseRadius, peakRadius, height, heightSegments, capSegments, roundedCaps) {
        super();

        // Variable declarations
        const pos = new Vec3();
        const bottomToTop = new Vec3();
        const norm = new Vec3();
        const top = new Vec3();
        const bottom = new Vec3();
        const tangent = new Vec3();
        const positions = [];
        const normals = [];
        const uvs = [];
        const uvs1 = [];
        const indices = [];
        let offset;

        // Define the body of the cone/cylinder
        if (height > 0) {
            for (let i = 0; i <= heightSegments; i++) {

                // A row with a zero radius collapses to the tip, and each of its vertices is used
                // by a single triangle, so center the vertex on that triangle's segment to keep its
                // normal and u unskewed. The triangles use the vertex at the segment's start at the
                // top, and the one at its end at the bottom.
                let tipOffset = 0;
                if (i === heightSegments && peakRadius === 0) {
                    tipOffset = 0.5;
                } else if (i === 0 && baseRadius === 0) {
                    tipOffset = -0.5;
                }

                for (let j = 0; j <= capSegments; j++) {
                    // Sweep the cone body from the positive Y axis to match a 3DS Max cone/cylinder
                    const theta = ((j + tipOffset) / capSegments) * 2 * Math.PI - Math.PI;
                    const sinTheta = Math.sin(theta);
                    const cosTheta = Math.cos(theta);
                    bottom.set(sinTheta * baseRadius, -height / 2, cosTheta * baseRadius);
                    top.set(sinTheta * peakRadius, height / 2, cosTheta * peakRadius);
                    pos.lerp(bottom, top, i / heightSegments);
                    bottomToTop.sub2(top, bottom).normalize();
                    tangent.set(cosTheta, 0, -sinTheta);
                    norm.cross(tangent, bottomToTop).normalize();

                    positions.push(pos.x, pos.y, pos.z);
                    normals.push(norm.x, norm.y, norm.z);
                    let u = (j + tipOffset) / capSegments;
                    let v = i / heightSegments;
                    uvs.push(u, 1 - v);

                    // Pack UV1 to 1st third
                    const _v = v;
                    v = u;
                    u = _v;
                    u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                    v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                    u /= 3;
                    uvs1.push(u, 1 - v);

                    if ((i < heightSegments) && (j < capSegments)) {
                        const first   = ((i))     * (capSegments + 1) + ((j));
                        const second  = ((i))     * (capSegments + 1) + ((j + 1));
                        const third   = ((i + 1)) * (capSegments + 1) + ((j));
                        const fourth  = ((i + 1)) * (capSegments + 1) + ((j + 1));

                        // Skip the triangle that collapses to a line at a tip
                        if (i > 0 || baseRadius > 0) {
                            indices.push(first, second, third);
                        }
                        if (i < heightSegments - 1 || peakRadius > 0) {
                            indices.push(second, fourth, third);
                        }
                    }
                }
            }
        }

        if (roundedCaps) {
            const latitudeBands = Math.floor(capSegments / 2);
            const longitudeBands = capSegments;
            const capOffset = height / 2;

            // Each pole vertex is used by a single triangle, so center its u on that triangle's
            // segment. The top triangles use the vertex at the segment's end, the bottom ones the
            // vertex at its start.
            const poleUOffset = 0.5 / longitudeBands;

            // Generate top cap - the caps index from the vertices generated so far, as the body is
            // skipped when the height is zero
            offset = positions.length / 3;
            for (let lat = 0; lat <= latitudeBands; lat++) {
                const theta = (lat * Math.PI * 0.5) / latitudeBands;
                const sinTheta = Math.sin(theta);
                const cosTheta = Math.cos(theta);

                for (let lon = 0; lon <= longitudeBands; lon++) {
                    // Sweep the sphere from the positive Z axis to match a 3DS Max sphere
                    const phi = lon * 2 * Math.PI / longitudeBands - Math.PI / 2;
                    const sinPhi = Math.sin(phi);
                    const cosPhi = Math.cos(phi);

                    const x = cosPhi * sinTheta;
                    const y = cosTheta;
                    const z = sinPhi * sinTheta;
                    let u = 1 - lon / longitudeBands + (lat === 0 ? poleUOffset : 0);
                    let v = 1 - lat / latitudeBands;

                    positions.push(x * peakRadius, y * peakRadius + capOffset, z * peakRadius);
                    normals.push(x, y, z);
                    uvs.push(u, 1 - v);

                    // Pack UV1 to 2nd third
                    u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                    v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                    u /= 3;
                    v /= 3;
                    u += 1.0 / 3;
                    uvs1.push(u, 1 - v);
                }
            }

            for (let lat = 0; lat < latitudeBands; ++lat) {
                for (let lon = 0; lon < longitudeBands; ++lon) {
                    const first  = (lat * (longitudeBands + 1)) + lon;
                    const second = first + longitudeBands + 1;

                    // Skip the triangle that collapses to a line at the pole
                    if (lat !== 0) {
                        indices.push(offset + first + 1, offset + second, offset + first);
                    }
                    indices.push(offset + first + 1, offset + second + 1, offset + second);
                }
            }

            // Generate bottom cap
            offset = positions.length / 3;
            for (let lat = 0; lat <= latitudeBands; lat++) {
                const theta = Math.PI * 0.5 + (lat * Math.PI * 0.5) / latitudeBands;
                const sinTheta = Math.sin(theta);
                const cosTheta = Math.cos(theta);

                for (let lon = 0; lon <= longitudeBands; lon++) {
                    // Sweep the sphere from the positive Z axis to match a 3DS Max sphere
                    const phi = lon * 2 * Math.PI / longitudeBands - Math.PI / 2;
                    const sinPhi = Math.sin(phi);
                    const cosPhi = Math.cos(phi);

                    const x = cosPhi * sinTheta;
                    const y = cosTheta;
                    const z = sinPhi * sinTheta;
                    let u = 1 - lon / longitudeBands - (lat === latitudeBands ? poleUOffset : 0);
                    let v = 1 - lat / latitudeBands;

                    positions.push(x * peakRadius, y * peakRadius - capOffset, z * peakRadius);
                    normals.push(x, y, z);
                    uvs.push(u, 1 - v);

                    // Pack UV1 to 3rd third
                    u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                    v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                    u /= 3;
                    v /= 3;
                    u += 2.0 / 3;
                    uvs1.push(u, 1 - v);
                }
            }

            for (let lat = 0; lat < latitudeBands; ++lat) {
                for (let lon = 0; lon < longitudeBands; ++lon) {
                    const first  = (lat * (longitudeBands + 1)) + lon;
                    const second = first + longitudeBands + 1;

                    indices.push(offset + first + 1, offset + second, offset + first);

                    // Skip the triangle that collapses to a line at the pole
                    if (lat !== latitudeBands - 1) {
                        indices.push(offset + first + 1, offset + second + 1, offset + second);
                    }
                }
            }
        } else {
            // Generate bottom cap - the caps index from the vertices generated so far, as the body is
            // skipped when the height is zero, and a cap is skipped when its radius is zero
            offset = positions.length / 3;
            if (baseRadius > 0) {
                for (let i = 0; i < capSegments; i++) {
                    const theta = (i / capSegments) * 2 * Math.PI;
                    const x = Math.sin(theta);
                    const y = -height / 2;
                    const z = Math.cos(theta);
                    let u = 1 - (x + 1) / 2;
                    let v = (z + 1) / 2;

                    positions.push(x * baseRadius, y, z * baseRadius);
                    normals.push(0, -1, 0);
                    uvs.push(u, 1 - v);

                    // Pack UV1 to 2nd third
                    u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                    v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                    u /= 3;
                    v /= 3;
                    u += 1 / 3;
                    uvs1.push(u, 1 - v);

                    if (i > 1) {
                        indices.push(offset, offset + i, offset + i - 1);
                    }
                }
            }

            // Generate top cap
            offset = positions.length / 3;
            if (peakRadius > 0) {
                for (let i = 0; i < capSegments; i++) {
                    const theta = (i / capSegments) * 2 * Math.PI;
                    const x = Math.sin(theta);
                    const y = height / 2;
                    const z = Math.cos(theta);
                    let u = 1 - (x + 1) / 2;
                    let v = (z + 1) / 2;

                    positions.push(x * peakRadius, y, z * peakRadius);
                    normals.push(0, 1, 0);
                    uvs.push(u, 1 - v);

                    // Pack UV1 to 3rd third
                    u = u * primitiveUv1PaddingScale + primitiveUv1Padding;
                    v = v * primitiveUv1PaddingScale + primitiveUv1Padding;
                    u /= 3;
                    v /= 3;
                    u += 2 / 3;
                    uvs1.push(u, 1 - v);

                    if (i > 1) {
                        indices.push(offset, offset + i - 1, offset + i);
                    }
                }
            }
        }

        this.positions = positions;
        this.normals = normals;
        this.uvs = uvs;
        this.uvs1 = uvs1;
        this.indices = indices;
    }
}

export { ConeBaseGeometry };
