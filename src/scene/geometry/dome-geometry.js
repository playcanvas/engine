import { SphereGeometry } from './sphere-geometry.js';

/**
 * A procedural dome-shaped geometry.
 *
 * The size and tesselation properties of the dome can be controlled via constructor parameters.
 * Radius is fixed to 0.5.
 *
 * Note that the dome is created with UVs in the range of 0 to 1.
 *
 * ```javascript
 * // Create a mesh instance
 * const geometry = new pc.DomeGeometry();
 * const mesh = pc.Mesh.fromGeometry(app.graphicsDevice, geometry);
 * const material = new pc.StandardMaterial();
 * const meshInstance = new pc.MeshInstance(mesh, material);
 *
 * // Create an entity
 * const entity = new pc.Entity();
 * entity.addComponent('render', {
 *     meshInstances: [meshInstance]
 * });
 *
 * // Add the entity to the scene hierarchy
 * app.scene.root.addChild(entity);
 * ```
 *
 * @category Graphics
 */
class DomeGeometry extends SphereGeometry {
    /**
     * Create a new DomeGeometry instance.
     *
     * @param {object} [opts] - Options object.
     * @param {number} [opts.latitudeBands] - The number of divisions along the latitudinal axis of
     * the sphere. Defaults to 16.
     * @param {number} [opts.longitudeBands] - The number of divisions along the longitudinal axis of
     * the sphere. Defaults to 16.
     * @example
     * const geometry = new pc.DomeGeometry({
     *     latitudeBands: 32,
     *     longitudeBands: 32
     * });
     */
    constructor(opts = {}) {

        // create a sphere geometry
        const radius = 0.5; // the math and constants are based on a unit sphere
        const latitudeBands = opts.latitudeBands ?? 16;
        const longitudeBands = opts.longitudeBands ?? 16;

        super({
            radius,
            latitudeBands,
            longitudeBands
        });

        // post-process the geometry to flatten the bottom hemisphere
        const bottomLimit = 0.1; // flatten bottom y-coordinate
        const curvatureRadius = 0.95; // normalized distance from the center that is completely flat
        const curvatureRadiusSq = curvatureRadius * curvatureRadius; // derived values

        const positions = this.positions;
        for (let i = 0; i < positions.length; i += 3) {

            const x = positions[i] / radius;
            let y = positions[i + 1] / radius;
            const z = positions[i + 2] / radius;

            // flatten the lower hemisphere
            if (y < 0) {

                // scale vertices on the bottom
                y *= 0.3;

                // flatten the center
                if (x * x + z * z < curvatureRadiusSq) {
                    y = -bottomLimit;
                }
            }

            // adjust y to have the center at the flat bottom
            y += bottomLimit;
            y *= radius;

            positions[i + 1] = y;
        }
    }
}

export { DomeGeometry };
