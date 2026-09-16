import type { Asset, RenderHandler } from '../../build/playcanvas.js';

declare const handler: RenderHandler;
declare const asset: Asset;

handler.load('render', (err) => {
    const error: string | null = err;
    // @ts-expect-error The callback error must retain its type rather than becoming any.
    const invalid: number = err;
});
handler.load({ load: 'render', original: 'render' }, () => {}, asset);
handler.load('', () => {}, asset);

// @ts-expect-error URLs must be strings or URL objects.
handler.load(123, () => {});
// @ts-expect-error A completion callback is required.
handler.load('render', 'callback');
// @ts-expect-error The optional asset must be an Asset.
handler.load('render', () => {}, {});
