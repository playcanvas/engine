pc.extend(pc.shape, function () {
    pc.shape.Type.FRUSTUM = "Frustum";

    var viewProj = new pc.Mat4();

    /**
     * Frustum
     * @constructor
     * @param {pc.math.mat4} projectionMatrix The projection matrix describing the shape of the frustum.
     * @param {pc.math.mat4} viewMatrix The inverse of the world transformation matrix for the frustum.
     */
    var Frustum = function Frustum (projectionMatrix, viewMatrix) {
        projectionMatrix = projectionMatrix || new pc.Mat4().perspective(90.0, 16 / 9, 0.1, 1000.0);
        viewMatrix = viewMatrix || pc.Mat4.IDENTITY.clone();

        this.planes = [];
        for (var i = 0; i < 6; i++) {
            this.planes[i] = [];
        }

        this.update(projectionMatrix, viewMatrix);

        this.type = pc.shape.Type.FRUSTUM;
    };
    Frustum = pc.inherits(Frustum, pc.shape.Shape);

    Frustum.prototype.update = function (projectionMatrix, viewMatrix) {
        viewProj.mul2(projectionMatrix, viewMatrix);
        var vpm = viewProj.data;

        // Extract the numbers for the RIGHT plane
        this.planes[0][0] = vpm[ 3] - vpm[ 0];
        this.planes[0][1] = vpm[ 7] - vpm[ 4];
        this.planes[0][2] = vpm[11] - vpm[ 8];
        this.planes[0][3] = vpm[15] - vpm[12];
        // Normalize the result
        t = Math.sqrt(this.planes[0][0] * this.planes[0][0] + this.planes[0][1] * this.planes[0][1] + this.planes[0][2] * this.planes[0][2]);
        this.planes[0][0] /= t;
        this.planes[0][1] /= t;
        this.planes[0][2] /= t;
        this.planes[0][3] /= t;

        // Extract the numbers for the LEFT plane
        this.planes[1][0] = vpm[ 3] + vpm[ 0];
        this.planes[1][1] = vpm[ 7] + vpm[ 4];
        this.planes[1][2] = vpm[11] + vpm[ 8];
        this.planes[1][3] = vpm[15] + vpm[12];
        // Normalize the result
        t = Math.sqrt(this.planes[1][0] * this.planes[1][0] + this.planes[1][1] * this.planes[1][1] + this.planes[1][2] * this.planes[1][2]);
        this.planes[1][0] /= t;
        this.planes[1][1] /= t;
        this.planes[1][2] /= t;
        this.planes[1][3] /= t;

        // Extract the BOTTOM plane
        this.planes[2][0] = vpm[ 3] + vpm[ 1];
        this.planes[2][1] = vpm[ 7] + vpm[ 5];
        this.planes[2][2] = vpm[11] + vpm[ 9];
        this.planes[2][3] = vpm[15] + vpm[13];
        // Normalize the result
        t = Math.sqrt(this.planes[2][0] * this.planes[2][0] + this.planes[2][1] * this.planes[2][1] + this.planes[2][2] * this.planes[2][2] );
        this.planes[2][0] /= t;
        this.planes[2][1] /= t;
        this.planes[2][2] /= t;
        this.planes[2][3] /= t;
        
        // Extract the TOP plane
        this.planes[3][0] = vpm[ 3] - vpm[ 1];
        this.planes[3][1] = vpm[ 7] - vpm[ 5];
        this.planes[3][2] = vpm[11] - vpm[ 9];
        this.planes[3][3] = vpm[15] - vpm[13];
        // Normalize the result
        t = Math.sqrt(this.planes[3][0] * this.planes[3][0] + this.planes[3][1] * this.planes[3][1] + this.planes[3][2] * this.planes[3][2]);
        this.planes[3][0] /= t;
        this.planes[3][1] /= t;
        this.planes[3][2] /= t;
        this.planes[3][3] /= t;
        
        // Extract the FAR plane
        this.planes[4][0] = vpm[ 3] - vpm[ 2];
        this.planes[4][1] = vpm[ 7] - vpm[ 6];
        this.planes[4][2] = vpm[11] - vpm[10];
        this.planes[4][3] = vpm[15] - vpm[14];
        // Normalize the result
        t = Math.sqrt(this.planes[4][0] * this.planes[4][0] + this.planes[4][1] * this.planes[4][1] + this.planes[4][2] * this.planes[4][2]);
        this.planes[4][0] /= t;
        this.planes[4][1] /= t;
        this.planes[4][2] /= t;
        this.planes[4][3] /= t;

        // Extract the NEAR plane
        this.planes[5][0] = vpm[ 3] + vpm[ 2];
        this.planes[5][1] = vpm[ 7] + vpm[ 6];
        this.planes[5][2] = vpm[11] + vpm[10];
        this.planes[5][3] = vpm[15] + vpm[14];
        // Normalize the result
        t = Math.sqrt(this.planes[5][0] * this.planes[5][0] + this.planes[5][1] * this.planes[5][1] + this.planes[5][2] * this.planes[5][2]);
        this.planes[5][0] /= t;
        this.planes[5][1] /= t;
        this.planes[5][2] /= t;
        this.planes[5][3] /= t;
    };

    /**
     * Tests whether a point is inside the frustum. Note that points lying in a frustum plane are
     * considered to be outside the frustum.
     * @param {pc.math.vec3} point Point to test
     * @returns Boolean indicating true if the point is inside the frustum, false otherwise
     */
    Frustum.prototype.containsPoint = function (point) {
        for (var p = 0; p < 6; p++)
            if (this.planes[p][0] * point[0] + 
                this.planes[p][1] * point[1] + 
                this.planes[p][2] * point[2] + 
                this.planes[p][3] <= 0)
                return false;
        return true;
    };

    /**
     * Tests whether a sphere is intersects the frustum. If the sphere is outside the frustum, zero is returned.
     * If the sphere intersects the frustum, 1 is returned. If the sphere is completely inside the frustum, 2 is
     * returned. Note that a sphere touching a frustum plane from the outside is considered to be outside the frustum.
     * @param {pc.shape.Sphere} sphere Sphere to test
     * @returns 0 if the sphere is outside the frustum, 1 if it intersects the frustum and 2 if it is contained 
     * by the frustum
     */
    Frustum.prototype.containsSphere = function (sphere) {
        var c = 0;
        var d;
        for (p = 0; p < 6; p++) {
            d = this.planes[p][0] * sphere.center[0] + 
                this.planes[p][1] * sphere.center[1] + 
                this.planes[p][2] * sphere.center[2] + 
                this.planes[p][3];
            if (d <= -sphere.radius)
                return 0;
            if (d > sphere.radius)
                c++;
        }
        return (c === 6) ? 2 : 1;
    };

    return {
        Frustum: Frustum
    };
}());