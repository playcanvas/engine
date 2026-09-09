import type { AppBase } from '../../build/playcanvas.js';

declare const app: AppBase;

const user: Map<string, number> = app.stats.user;
user.set('ai', 2.5);
const duration: number | undefined = user.get('ai');
user.delete('ai');
user.clear();

// @ts-expect-error Counter values must be numeric.
app.stats.user.set('ai', 'slow');
// @ts-expect-error Counter names must be strings.
app.stats.user.set(1, 2.5);
// @ts-expect-error The map can be mutated, but its reference cannot be replaced.
app.stats.user = new Map<string, number>();
