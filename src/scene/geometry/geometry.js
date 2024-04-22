import { Debug } from "../../core/debug.js";
import { calculateNormals, calculateTangents } from "./geometry-utils.js";

/**
 * The Geometry class serves as a container for storing geometric information. It encapsulates data
 * such as positions, normals, colors, and indices.
 *
 * @category Graphics
 */
class Geometry {
    /**
     * Positions.
     *
     * @type {number[]|undefined}
     */
    positions;

    /**
     * Normals.
     *
     * @type {number[]|undefined}
     */
    normals;

    /**
     * Colors.
     *
     * @type {number[]|undefined}
     */
    colors;

    /**
     * UVs.
     *
     * @type {number[]|undefined}
     */
    uvs;

    /**
     * Additional Uvs.
     *
     * @type {number[]|undefined}
     */
    uvs1;

    /**
     * Blend indices.
     *
     * @type {number[]|undefined}
     */
    blendIndices;

    /**
     * Blend weights.
     *
     * @type {number[]|undefined}
     */
    blendWeights;

    /**
     * Tangents.
     *
     * @type {number[]|undefined}
     */
    tangents;

    /**
     * Indices.
     *
     * @type {number[]|undefined}
     */
    indices;

    /**
     * Generates normal information from the positions and triangle indices.
     */
    calculateNormals() {
        Debug.assert(this.positions, 'Geometry must have positions set');
        Debug.assert(this.indices, 'Geometry must have indices set');
        this.normals = calculateNormals(this.positions, this.indices);
    }

    /**
     * Generates tangent information from the positions, normals, texture coordinates and triangle
     * indices.
     */
    calculateTangents() {
        Debug.assert(this.positions, 'Geometry must have positions set');
        Debug.assert(this.normals, 'Geometry must have normals set');
        Debug.assert(this.uvs, 'Geometry must have uvs set');
        Debug.assert(this.indices, 'Geometry must have indices set');
        this.tangents = calculateTangents(this.positions, this.normals, this.uvs, this.indices);
    }
}

export { Geometry };
