pc.extend(pc.shape, function () {
    // Add to the enumeration of types
    pc.shape.Type.SPHERE = "Sphere";

    /**
     * Sphere shape
     * @constructor
     * @class Create a new Sphere shape
     * @param {Vec3} center The center of the sphere.
     * @param {Vec3} radius Radius of sphere
     */
    var Sphere = function Sphere(center, radius) {
        this.center = center || pc.math.vec3.create(0, 0, 0);
        this.radius = radius || 1;
        
        this.type = pc.shape.Type.SPHERE;
    };
    Sphere = pc.inherits(Sphere, pc.shape.Shape);

    /**
     * Test whether point is inside sphere
     * @param {Vec3} point - point to test
     * @param {Vec3} sphere - sphere to check point against.
     */
    Sphere.prototype.containsPoint = function (point) {
        var offset = pc.math.vec3.create();
        pc.math.vec3.subtract(point, this.center, offset);
        var length = pc.math.vec3.length(offset);
        
        return (length < this.radius);
    };

    Sphere.prototype.compute = function (vertices) {
        var i;
        var numVerts = vertices.length / 3;
        
        var vertex = pc.math.vec3.create(0, 0, 0);
        
        // FIRST PASS:
        // Find the "average vertex", which is the sphere's center...
        var avgVertex = pc.math.vec3.create(0, 0, 0);
        var sum = pc.math.vec3.create(0, 0, 0);

        for (i = 0; i < numVerts; i++) {
            pc.math.vec3.set(vertex, vertices[i*3], vertices[i*3+1], vertices[i*3+2]);
            pc.math.vec3.add(sum, vertex, sum);

            // apply a part-result to avoid float-overflows
            if (i % 100 === 0) {
                pc.math.vec3.scale(sum, 1.0 / numVerts, sum);
                pc.math.vec3.add(avgVertex, sum, avgVertex);
                pc.math.vec3.set(sum, 0.0, 0.0, 0.0);
            }
        }

        pc.math.vec3.scale(sum, 1.0 / numVerts, sum);
        pc.math.vec3.add(avgVertex, sum, avgVertex);
        pc.math.vec3.set(sum, 0.0, 0.0, 0.0);

        this.center = avgVertex;

        // SECOND PASS:
        // Find the maximum (squared) distance of all vertices to the center...
        var maxDistSq = 0.0;
        var centerToVert = pc.math.vec3.create(0, 0, 0);

        for (i = 0; i < numVerts; i++) {
            pc.math.vec3.set(vertex, vertices[i*3], vertices[i*3+1], vertices[i*3+2]);

            pc.math.vec3.subtract(vertex, this.center, centerToVert);
            var distSq = pc.math.vec3.dot(centerToVert, centerToVert);
            if (distSq > maxDistSq)
                maxDistSq = distSq;
        }
        
        this.radius = Math.sqrt(maxDistSq);
    };
    
    return {
        Sphere: Sphere
    };
    
}());
