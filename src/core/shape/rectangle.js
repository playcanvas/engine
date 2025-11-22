import { Vec2 } from '../math/vec2.js';
import { Ray } from '../shape/ray.js';

class Rectangle {
  constructor(position = new Vec2(), size = new Vec2(1, 1), rotation = 0) {
    this.position = position;   // Vec2
    this.size = size;           // Vec2 (width, height)
    this.rotation = rotation;   // radians
  }

  // Get rotated corners of rectangle
  getCorners() {
    const hw = this.size.x / 2;
    const hh = this.size.y / 2;

    // Unrotated corner offsets
    const corners = [
      new Vec2(-hw, -hh),
      new Vec2(hw, -hh),
      new Vec2(hw, hh),
      new Vec2(-hw, hh),
    ];

    // Rotate corners by rotation angle and translate by position
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);

    for (let i = 0; i < corners.length; i++) {
      const x = corners[i].x;
      const y = corners[i].y;
      corners[i].x = this.position.x + x * cos - y * sin;
      corners[i].y = this.position.y + x * sin + y * cos;
    }
    
    return corners;
  }

  // Basic intersection: check ray against rectangle edges
  intersectsRay(ray) {
    // Using the ray parameterization and checking intersection with each edge segment
    const corners = this.getCorners();

    let closestDist = Infinity;
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % corners.length];

      const denom = (b.y - a.y) * ray.direction.x - (b.x - a.x) * ray.direction.y;
      if (denom === 0) {
        continue; // Parallel, no intersection
      }

      const t = ((b.x - a.x) * (ray.origin.y - a.y) - (b.y - a.y) * (ray.origin.x - a.x)) / denom;
      const u = ((ray.direction.x) * (ray.origin.y - a.y) - (ray.direction.y) * (ray.origin.x - a.x)) / denom;

      if (t >= 0 && u >= 0 && u <= 1) {
        if (t < closestDist) closestDist = t;
      }
    }

    return closestDist !== Infinity;
  }

  // Axis-Aligned rectangle overlap check (approximate for rotation = 0)
  intersectsRectangle(other) {
    if (this.rotation !== 0 || other.rotation !== 0) {
      // For simplicity, rotation not supported in this example
      // Use SAT or polygon intersection for rotated case
      throw new Error('Rotated rectangle intersection not implemented');
    }

    const ax1 = this.position.x - this.size.x / 2;
    const ax2 = this.position.x + this.size.x / 2;
    const ay1 = this.position.y - this.size.y / 2;
    const ay2 = this.position.y + this.size.y / 2;

    const bx1 = other.position.x - other.size.x / 2;
    const bx2 = other.position.x + other.size.x / 2;
    const by1 = other.position.y - other.size.y / 2;
    const by2 = other.position.y + other.size.y / 2;

    return !(ax2 < bx1 || ax1 > bx2 || ay2 < by1 || ay1 > by2);
  }
}

export { Rectangle };
