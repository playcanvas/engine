pc.extend(pc.shape, function () {
    // Add to the enumeration of types
    pc.shape.Type.SPHERE = "Sphere";

    /**
     * Sphere shape
     * @constructor
     * @class Create a new Sphere shape
     * @param {pc.Vec3} center The center of the sphere.
     * @param {Number} radius Radius of sphere
     */
    function Sphere(center, radius) {
        this.center = (center === undefined) ? new pc.Vec3(0, 0, 0) : center;
        this.radius = (radius === undefined) ? 1 : radius;

        this.type = pc.shape.Type.SPHERE;
    };
    Sphere = pc.inherits(Sphere, pc.shape.Shape);

    /**
     * Test whether point is inside sphere
     * @param {pc.Vec3} point Point to test
     */
    Sphere.prototype.containsPoint = function (point) {
        var offset = new pc.Vec3();
        offset.sub(point, this.center);
        var length = offset.length();

        return (length < this.radius);
    };

    Sphere.prototype.compute = function (vertices) {
        var i;
        var numVerts = vertices.length / 3;

        var vertex = new pc.Vec3(0, 0, 0);

        // FIRST PASS:
        // Find the "average vertex", which is the sphere's center...
        var avgVertex = new pc.Vec3(0, 0, 0);
        var sum = new pc.Vec3(0, 0, 0);

        for (i = 0; i < numVerts; i++) {
            vertex.set(vertices[i*3], vertices[i*3+1], vertices[i*3+2]);
            sum.addSelf(vertex);

            // apply a part-result to avoid float-overflows
            if (i % 100 === 0) {
                sum.scale(1 / numVerts);
                avgVertex.add(sum);
                sum.set(0, 0, 0);
            }
        }

        sum.scale(1 / numVerts);
        avgVertex.add(sum);

        this.center.copy(avgVertex);

        // SECOND PASS:
        // Find the maximum (squared) distance of all vertices to the center...
        var maxDistSq = 0;
        var centerToVert = new pc.Vec3(0, 0, 0);

        for (i = 0; i < numVerts; i++) {
            vertex.set(vertices[i*3], vertices[i*3+1], vertices[i*3+2]);

            centerToVert.sub(vertex, this.center);
            maxDistSq = Math.max(centerToVert.lengthSq(), maxDistSq);
        }

        this.radius = Math.sqrt(maxDistSq);
    };

    return {
        Sphere: Sphere
    };
}());