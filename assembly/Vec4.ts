export class Vec4 {
    x: number;
    y: number;
    z: number;
    w: number;

    constructor(x: number, y: number, z: number, w: number) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
    }

    add(rhs: Vec4): Vec4 {
        this.x += rhs.x;
        this.y += rhs.y;
        this.z += rhs.z;
        this.w += rhs.w;
        return this;
    }

    add2(lhs: Vec4, rhs: Vec4): Vec4 {
        this.x = lhs.x + rhs.x;
        this.y = lhs.y + rhs.y;
        this.z = lhs.z + rhs.z;
        this.w = lhs.w + rhs.w;
        return this;
    }

    clone(): Vec4 {
        var tmp = new Vec4(0, 0, 0, 0);
        tmp.copy(this);
        return tmp;
    }

    copy(rhs: Vec4): Vec4 {
        this.x = rhs.x;
        this.y = rhs.y;
        this.z = rhs.z;
        this.w = rhs.w;
        return this;
    }

    dot(rhs: Vec4): number {
        return this.x * rhs.x + this.y * rhs.y + this.z * rhs.z + this.w * rhs.w;
    }

    equals(rhs: Vec4): boolean {
        return this.x === rhs.x && this.y === rhs.y && this.z === rhs.z && this.w === rhs.w;
    }

    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
    }

    lengthSq(): number {
        return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
    }

    lerp(lhs: Vec4, rhs: Vec4, alpha: number): Vec4 {
        this.x = lhs.x + alpha * (rhs.x - lhs.x);
        this.y = lhs.y + alpha * (rhs.y - lhs.y);
        this.z = lhs.z + alpha * (rhs.z - lhs.z);
        this.w = lhs.w + alpha * (rhs.w - lhs.w);
        return this;
    }

    mul(rhs: Vec4): Vec4 {
        this.x *= rhs.x;
        this.y *= rhs.y;
        this.z *= rhs.z;
        this.w *= rhs.w;
        return this;
    }

    mul2(lhs: Vec4, rhs: Vec4): Vec4 {
        this.x = lhs.x * rhs.x;
        this.y = lhs.y * rhs.y;
        this.z = lhs.z * rhs.z;
        this.w = lhs.w * rhs.w;
        return this;
    }

    normalize(): Vec4 {
        var lengthSq = this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
        if (lengthSq > 0.0) {
            var invLength: number = 1.0 / Math.sqrt(lengthSq);
            this.x *= invLength;
            this.y *= invLength;
            this.z *= invLength;
            this.w *= invLength;
        }
        return this;
    }

    scale(scalar: number): Vec4 {
        this.x *= scalar;
        this.y *= scalar;
        this.z *= scalar;
        this.w *= scalar;
        return this;
    }

    set(x: number, y: number, z: number, w: number): Vec4 {
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
        return this;
    }

    sub(rhs: Vec4): Vec4 {
        this.x -= rhs.x;
        this.y -= rhs.y;
        this.z -= rhs.z;
        this.w -= rhs.w;
        return this;
    }

    sub2(lhs: Vec4, rhs: Vec4): Vec4 {
        this.x = lhs.x - rhs.x;
        this.y = lhs.y - rhs.y;
        this.z = lhs.z - rhs.z;
        this.w = lhs.w - rhs.w;
        return this;
    }
}
