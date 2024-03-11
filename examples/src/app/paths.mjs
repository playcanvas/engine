const href = typeof location !== 'undefined' ? location.href : '';
const url = new URL(href);
const root = url.pathname.replace(/\/([^/]+\.html)?$/g, '');

export const assetPath = root + '/static/assets/';

export const pcTypes = root + '/playcanvas.d.ts';

export const iframePath = root + '/iframe/';

export const thumbnailPath = root + '/thumbnails/';

export const logo = root + '/playcanvas-logo.png';
