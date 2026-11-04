// Consumer-side type tests for AnimComponent#findLayer and its deprecated alias. Compiled by
// `npm run test:types` against build/playcanvas.d.ts under strict mode.
import { Entity } from '../../build/playcanvas.js';
import type { AnimComponentLayer } from '../../build/playcanvas.js';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

const anim = new Entity().addComponent('anim')!;

// findLayer reports a missing layer as null
const layer = anim.findLayer('UpperBody');
type T1 = Expect<Equal<typeof layer, AnimComponentLayer | null>>;
layer?.play('Walk');

// the deprecated alias keeps its pre-rename non-null type, so existing callers still compile
const legacy = anim.findAnimationLayer('UpperBody');
type T2 = Expect<Equal<typeof legacy, AnimComponentLayer>>;
anim.findAnimationLayer('UpperBody').play('Walk');
