import { expect } from 'chai';
import { Rectangle } from '../../../src/core/shape/rectangle.js';
import { Vec2 } from '../../../src/core/math/vec2.js';
import { Ray } from '../../../src/core/shape/ray.js';

describe('Rectangle', () => {
  it('should create rectangle with given position, size and rotation', () => {
    const rect = new Rectangle(new Vec2(1, 2), new Vec2(4, 6), Math.PI / 4);
    expect(rect.position.x).to.equal(1);
    expect(rect.size.x).to.equal(4);
    expect(rect.rotation).to.be.closeTo(Math.PI / 4, 0.0001);
  });

  it('should compute corners correctly', () => {
    const rect = new Rectangle(new Vec2(0, 0), new Vec2(2, 2), 0);
    const corners = rect.getCorners();
    expect(corners).to.have.lengthOf(4);
    expect(corners[0].x).to.be.closeTo(-1, 0.0001);
  });

  it('should detect ray intersection with rectangle', () => {
    const rect = new Rectangle(new Vec2(0, 0), new Vec2(2, 2), 0);
    const ray = new Ray(new Vec2(-3, 0), new Vec2(1, 0));
    expect(rect.intersectsRay(ray)).to.equal(true);

    const ray2 = new Ray(new Vec2(-3, 3), new Vec2(1, 0));
    expect(rect.intersectsRay(ray2)).to.equal(false);
  });

  it('should detect rectangle intersection (no rotation)', () => {
    const rect1 = new Rectangle(new Vec2(0, 0), new Vec2(2, 2));
    const rect2 = new Rectangle(new Vec2(1, 0), new Vec2(2, 2));
    expect(rect1.intersectsRectangle(rect2)).to.equal(true);

    const rect3 = new Rectangle(new Vec2(5, 5), new Vec2(2, 2));
    expect(rect1.intersectsRectangle(rect3)).to.equal(false);
  });
});
