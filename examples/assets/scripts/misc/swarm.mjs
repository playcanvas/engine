import { Color, Entity, Script, StandardMaterial, Vec3 } from 'playcanvas';

const position = new Vec3();
const ahead = new Vec3();

/**
 * A swarm of glowing orbs circling above the entity. Its update moves them and its post-update
 * turns each to face along its path. Both also run a stand-in for heavier game logic, whose cost
 * rises and falls on a sine wave at a different pace for each, so a profiler has script time that
 * changes to show.
 */
class Swarm extends Script {
    static scriptName = 'swarm';

    /**
     * How many orbs fly.
     *
     * @attribute
     */
    count = 40;

    /**
     * The most time the stand-in work of the update takes, in milliseconds.
     *
     * @attribute
     */
    updateCost = 1.5;

    /**
     * How many seconds the cost of the update takes to rise and fall.
     *
     * @attribute
     */
    updatePeriod = 3;

    /**
     * The most time the stand-in work of the post-update takes, in milliseconds.
     *
     * @attribute
     */
    postUpdateCost = 0.8;

    /**
     * How many seconds the cost of the post-update takes to rise and fall.
     *
     * @attribute
     */
    postUpdatePeriod = 7;

    /** @type {{ entity: Entity, angle: number, speed: number, phase: number }[]} */
    orbs = [];

    time = 0;

    // the result of the stand-in work, kept so it is not optimized away
    sink = 0;

    initialize() {
        const material = new StandardMaterial();
        material.name = 'swarm material';
        material.diffuse = new Color(0.1, 0.1, 0.1);
        material.emissive = new Color(0.4, 0.8, 1);
        material.emissiveIntensity = 3;
        material.update();

        for (let i = 0; i < this.count; i++) {
            const entity = new Entity(`orb ${i}`);
            entity.addComponent('render', { type: 'cone', material, castShadows: false });
            entity.setLocalScale(0.08, 0.16, 0.08);
            this.entity.addChild(entity);
            this.orbs.push({
                entity,
                angle: (i / this.count) * Math.PI * 2,
                speed: 0.4 + Math.random() * 0.4,
                phase: Math.random() * Math.PI * 2
            });
        }

        this.on('destroy', () => material.destroy());
    }

    /**
     * @param {number} angle - How far around its circle an orb is.
     * @param {number} phase - Its own offset, so the orbs do not move in step.
     * @param {Vec3} out - Receives where it is, relative to the entity.
     * @returns {Vec3} The position.
     */
    orbit(angle, phase, out) {
        const radius = 2.5 + 0.5 * Math.sin(angle * 3 + phase);
        return out.set(Math.cos(angle) * radius, 2 + 0.6 * Math.sin(angle * 2 + phase), Math.sin(angle) * radius);
    }

    update(dt) {
        this.time += dt;
        for (const orb of this.orbs) {
            orb.angle += dt * orb.speed;
            orb.entity.setLocalPosition(this.orbit(orb.angle, orb.phase, position));
        }
        this.work(this.updateCost, this.updatePeriod);
    }

    postUpdate() {
        for (const orb of this.orbs) {
            this.orbit(orb.angle + 0.05, orb.phase, ahead);
            this.entity.getWorldTransform().transformPoint(ahead, ahead);
            orb.entity.lookAt(ahead);
            // a cone points up its height: turn that forward, where lookAt aims
            orb.entity.rotateLocal(-90, 0, 0);
        }
        this.work(this.postUpdateCost, this.postUpdatePeriod);
    }

    /**
     * Stands in for heavier game logic: keeps busy for a time that rises from nothing to the most
     * it takes and back over a period.
     *
     * @param {number} cost - The most time it takes, in milliseconds.
     * @param {number} period - The seconds it takes to rise and fall.
     */
    work(cost, period) {
        const ms = cost * (0.5 - 0.5 * Math.cos((2 * Math.PI * this.time) / period));
        const until = performance.now() + ms;
        let x = this.sink;
        while (performance.now() < until) {
            for (let i = 0; i < 100; i++) x = Math.sqrt(x + i);
        }
        this.sink = x;
    }
}

export { Swarm };
