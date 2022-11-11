import { Application } from '../../../src/framework/application.js';
import { Asset } from '../../../src/framework/asset/asset.js';

import { HTMLCanvasElement } from '@playcanvas/canvas-mock';

import { expect } from 'chai';

describe('Asset', function () {

    let app;

    beforeEach(function () {
        const canvas = new HTMLCanvasElement(500, 500);
        app = new Application(canvas);
    });

    afterEach(function () {
        app.destroy();
    });

    const DEFAULT_LOCALE_FALLBACKS = {
        'en': 'en-US',
        'es': 'en-ES',
        'zh': 'zh-CN',
        'fr': 'fr-FR',
        'de': 'de-DE',
        'it': 'it-IT',
        'ru': 'ru-RU',
        'ja': 'ja-JP'
    };

    describe('#getLocalizedAssetId', function () {

        it('should return null if no localizations exist', function () {
            const asset = new Asset('asset', 'font');
            asset.id = 1000;
            expect(asset.getLocalizedAssetId('en')).to.equal(null);
        });

        it('should return fallback language if available', function () {
            const asset = new Asset('asset', 'font');

            let id = 1000;
            for (const key in DEFAULT_LOCALE_FALLBACKS) {
                asset.addLocalizedAssetId(DEFAULT_LOCALE_FALLBACKS[key], id);
                id++;
            }

            id = 1000;
            for (const key in DEFAULT_LOCALE_FALLBACKS) {
                expect(asset.getLocalizedAssetId(key)).to.equal(id);
                id++;
            }
        });

        it('should return fallback language if available', function () {
            const asset = new Asset('asset', 'font');

            let id = 1000;
            for (const key in DEFAULT_LOCALE_FALLBACKS) {
                asset.addLocalizedAssetId(DEFAULT_LOCALE_FALLBACKS[key], id);
                id++;
            }

            id = 1000;
            for (const key in DEFAULT_LOCALE_FALLBACKS) {
                expect(asset.getLocalizedAssetId(key)).to.equal(id);
                id++;
            }
        });

        it('should return fallback language if available', function () {
            const asset = new Asset('asset', 'font');

            let id = 1;
            for (const key in DEFAULT_LOCALE_FALLBACKS) {
                asset.addLocalizedAssetId(key + '-test', 1000 + id); // add other locale with same language which shouldn't be used
                asset.addLocalizedAssetId(DEFAULT_LOCALE_FALLBACKS[key], 2000 + id);
                id++;
            }

            id = 1;
            for (const key in DEFAULT_LOCALE_FALLBACKS) {
                expect(asset.getLocalizedAssetId(key)).to.equal(2000 + id);
                id++;
            }
        });

        it('zh-HK should return zh-HK if it exists', function () {
            const asset = new Asset('asset', 'font');

            asset.addLocalizedAssetId('zh-CN', 1);
            asset.addLocalizedAssetId('zh-HK', 2);
            asset.addLocalizedAssetId('zh-TW', 3);

            expect(asset.getLocalizedAssetId('zh-HK')).to.equal(2);
        });

        it('zh-HK should fallback to zh-TW', function () {
            const asset = new Asset('asset', 'font');

            asset.addLocalizedAssetId('zh-CN', 1);
            asset.addLocalizedAssetId('zh-TW', 2);

            expect(asset.getLocalizedAssetId('zh-HK')).to.equal(2);
        });

        it('zh-TW should fallback to zh-HK', function () {
            const asset = new Asset('asset', 'font');

            asset.addLocalizedAssetId('zh-CN', 1);
            asset.addLocalizedAssetId('zh-HK', 2);

            expect(asset.getLocalizedAssetId('zh-TW')).to.equal(2);
        });

        it('zh-SG should fallback to zh-CN', function () {
            const asset = new Asset('asset', 'font');

            asset.addLocalizedAssetId('zh-HK', 1);
            asset.addLocalizedAssetId('zh-CN', 2);
            asset.addLocalizedAssetId('zh-TW', 2);

            expect(asset.getLocalizedAssetId('zh-SG')).to.equal(2);
        });

    });

});
