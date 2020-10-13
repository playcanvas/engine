export class Vec2 {
    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    add(rhs: Vec2): Vec2 {
        this.x += rhs.x;
        this.y += rhs.y;
        return this;
    }

    add2(lhs: Vec2, rhs: Vec2): Vec2 {
        this.x = lhs.x + rhs.x;
        this.y = lhs.y + rhs.y;
        return this;
    }

    clone(): Vec2 {
        var tmp = new Vec2(0, 0);
        tmp.copy(this);
        return tmp;
    }

    copy(rhs: Vec2): Vec2 {
        this.x = rhs.x;
        this.y = rhs.y;
        return this;
    }

    dot(rhs: Vec2): number {
        return this.x * rhs.x + this.y * rhs.y;
    }

    equals(rhs: Vec2): boolean {
        return this.x === rhs.x && this.y === rhs.y;
    }

    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    lengthSq(): number {
        return this.x * this.x + this.y * this.y;
    }

    lerp(lhs: Vec2, rhs: Vec2, alpha: number): Vec2 {
        this.x = lhs.x + alpha * (rhs.x - lhs.x);
        this.y = lhs.y + alpha * (rhs.y - lhs.y);
        return this;
    }

    mul(rhs: Vec2): Vec2 {
        this.x *= rhs.x;
        this.y *= rhs.y;
        return this;
    }

    mul2(lhs: Vec2, rhs: Vec2): Vec2 {
        this.x = lhs.x * rhs.x;
        this.y = lhs.y * rhs.y;
        return this;
    }

    normalize(): Vec2 {
        var lengthSq = this.x * this.x + this.y * this.y;
        if (lengthSq > 0.0) {
            var invLength: number = 1.0 / Math.sqrt(lengthSq);
            this.x *= invLength;
            this.y *= invLength;
        }
        return this;
    }

    scale(scalar: number): Vec2 {
        this.x *= scalar;
        this.y *= scalar;
        return this;
    }

    set(x: number, y: number): Vec2 {
        this.x = x;
        this.y = y;
        return this;
    }
     
    sub(rhs: Vec2): Vec2 {
        this.x -= rhs.x;
        this.y -= rhs.y;
        return this;
    }

    sub2(lhs: Vec2, rhs: Vec2): Vec2 {
        this.x = lhs.x - rhs.x;
        this.y = lhs.y - rhs.y;
        return this;
    }
}
