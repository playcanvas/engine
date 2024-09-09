import { Layer } from '../../../src/scene/layer.js';
import { LayerComposition } from '../../../src/scene/composition/layer-composition.js';

import { expect } from 'chai';

describe('LayerComposition', function () {

    beforeEach(function () {
        this.composition = new LayerComposition();
        this.layer = new Layer({
            id: 1,
            name: 'layer'
        });
    });

    this.afterEach(function () {
        this.layer = null;
        this.composition = null;
    });

    describe('#constructor', function () {

        it('creates a new LayerComposition', function () {
            expect(this.composition).to.be.an.instanceof(LayerComposition);
        });

    });

    describe('#getLayerById', function () {

        it('should work after push()', function () {
            this.composition.push(this.layer);
            expect(this.composition.getLayerById(this.layer.id)).to.equal(this.layer);
        });

        it('should work after insert()', function () {
            this.composition.insert(this.layer, 0);
            expect(this.composition.getLayerById(this.layer.id)).to.equal(this.layer);
        });

        it('should return null after remove()', function () {
            this.composition.insert(this.layer, 0);
            this.composition.remove(this.layer);
            expect(this.composition.getLayerById(this.layer.id)).to.equal(null);
        });

        it('should work after pushOpaque()', function () {
            this.composition.pushOpaque(this.layer);
            expect(this.composition.getLayerById(this.layer.id)).to.equal(this.layer);
        });

        it('should work after insertOpaque()', function () {
            this.composition.insertOpaque(this.layer, 0);
            expect(this.composition.getLayerById(this.layer.id)).to.equal(this.layer);
        });

        it('should return null after removeOpaque()', function () {
            this.composition.insertOpaque(this.layer, 0);
            this.composition.removeOpaque(this.layer, 0);
            expect(this.composition.getLayerById(this.layer.id)).to.equal(null);
        });

        it('should work after pushTransparent()', function () {
            this.composition.pushTransparent(this.layer);
            expect(this.composition.getLayerById(this.layer.id)).to.equal(this.layer);
        });

        it('should work after insertTransparent()', function () {
            this.composition.insertTransparent(this.layer, 0);
            expect(this.composition.getLayerById(this.layer.id)).to.equal(this.layer);
        });

        it('should return null after removeTransparent()', function () {
            this.composition.insertTransparent(this.layer, 0);
            this.composition.removeTransparent(this.layer, 0);
            expect(this.composition.getLayerById(this.layer.id)).to.equal(null);
        });

    });

    describe('#getOpaqueIndex', function () {

        it('should return correct index after push()', function () {
            this.composition.push(this.layer);
            expect(this.composition.getOpaqueIndex(this.layer)).to.equal(0);
        });

        it('should return correct index after pushOpaque()', function () {
            this.composition.pushTransparent(this.layer);
            this.composition.pushOpaque(this.layer);
            expect(this.composition.getOpaqueIndex(this.layer)).to.equal(1);
        });

        it('should return correct index after insertOpaque()', function () {
            this.composition.pushTransparent(this.layer);
            this.composition.insertOpaque(this.layer, 1);
            expect(this.composition.getOpaqueIndex(this.layer)).to.equal(1);
        });

        it('should return -1 if layer not in composition', function () {
            expect(this.composition.getOpaqueIndex(this.layer)).to.equal(-1);
        });

    });

    describe('#getTransparentIndex', function () {

        it('should return correct index after push()', function () {
            this.composition.push(this.layer);
            expect(this.composition.getTransparentIndex(this.layer)).to.equal(1);
        });

        it('should return correct index after pushTransparent()', function () {
            this.composition.pushOpaque(this.layer);
            this.composition.pushTransparent(this.layer);
            expect(this.composition.getTransparentIndex(this.layer)).to.equal(1);
        });

        it('should return correct index after insertTransparent()', function () {
            this.composition.pushOpaque(this.layer);
            this.composition.insertTransparent(this.layer, 1);
            expect(this.composition.getTransparentIndex(this.layer)).to.equal(1);
        });

        it('should return -1 if layer not in composition', function () {
            expect(this.composition.getTransparentIndex(this.layer)).to.equal(-1);
        });

    });

    describe('#getLayerByName', function () {

        it('should return layer', function () {
            this.composition.push(this.layer);
            expect(this.composition.getLayerByName(this.layer.name)).to.equal(this.layer);
        });

        it('should return null if layer not in composition', function () {
            expect(this.composition.getLayerByName(this.layer.name)).to.equal(null);
        });

    });

    describe('#sortTransparentLayers', function () {

        it('should return negative if the first layers are on top of the second layers', function () {
            const layerFront = new Layer({ id: 2 });
            const layerBack = new Layer({ id: 3 });
            this.composition.push(layerBack);
            this.composition.push(layerFront);
            expect(this.composition.sortTransparentLayers([layerFront.id], [layerBack.id])).to.be.below(0);
        });

        it('should return negative if one the first layers is on top of the second layers', function () {
            const layerFront = new Layer({ id: 2 });
            const layerMiddle = new Layer({ id: 3 });
            const layerBack = new Layer({ id: 4 });
            this.composition.push(layerBack);
            this.composition.push(layerMiddle);
            this.composition.push(layerFront);
            expect(this.composition.sortTransparentLayers([layerBack.id, layerFront.id], [layerMiddle.id])).to.be.below(0);
        });

        it('should return negative if second layers not in composition', function () {
            this.composition.push(this.layer);
            expect(this.composition.sortTransparentLayers([this.layer.id], [2])).to.be.below(0);
        });

        it('should return positive if the second layers are on top of the first layers', function () {
            const layerFront = new Layer({ id: 2 });
            const layerBack = new Layer({ id: 3 });
            this.composition.push(layerBack);
            this.composition.push(layerFront);
            expect(this.composition.sortTransparentLayers([layerBack.id], [layerFront.id])).to.be.above(0);
        });

        it('should return positive if one the second layers is on top of the first layers', function () {
            const layerFront = new Layer({ id: 2 });
            const layerMiddle = new Layer({ id: 3 });
            const layerBack = new Layer({ id: 4 });
            this.composition.push(layerBack);
            this.composition.push(layerMiddle);
            this.composition.push(layerFront);
            expect(this.composition.sortTransparentLayers([layerMiddle.id], [layerBack.id, layerFront.id])).to.be.above(0);
        });

        it('should return positive if first layers not in composition', function () {
            this.composition.push(this.layer);
            expect(this.composition.sortTransparentLayers([2], [this.layer.id])).to.be.above(0);
        });

        it('should return 0 if both layers are the same', function () {
            this.composition.push(this.layer);
            expect(this.composition.sortTransparentLayers([this.layer.id], [this.layer.id])).to.equal(0);
        });

        it('should return 0 if both layers not in composition', function () {
            expect(this.composition.sortTransparentLayers([this.layer.id], [this.layer.id])).to.equal(0);
        });

        it('returns correct value after insert()', function () {
            const layerFront = new Layer({ id: 2 });
            const layerBack = new Layer({ id: 3 });
            this.composition.insert(layerFront, 0);
            this.composition.insert(layerBack, 0);
            expect(this.composition.sortTransparentLayers([layerBack.id], [layerFront.id])).to.be.above(0);
            expect(this.composition.sortTransparentLayers([layerFront.id], [layerBack.id])).to.be.below(0);
        });

        it('returns correct value after remove()', function () {
            const layerFront = new Layer({ id: 2 });
            const layerMiddle = new Layer({ id: 3 });
            const layerBack = new Layer({ id: 4 });
            this.composition.push(layerBack);
            this.composition.push(layerMiddle);
            this.composition.push(layerFront);
            this.composition.remove(layerMiddle);
            expect(this.composition.sortTransparentLayers([layerBack.id], [layerFront.id])).to.be.above(0);
            expect(this.composition.sortTransparentLayers([layerFront.id], [layerBack.id])).to.be.below(0);

            // re-add middle layer on top of the front layer
            this.composition.push(layerMiddle);
            expect(this.composition.sortTransparentLayers([layerFront.id], [layerMiddle.id])).to.be.above(0);
        });

        it('returns correct value after pushTransparent()', function () {
            const layerFront = new Layer({ id: 2 });
            const layerBack = new Layer({ id: 3 });
            this.composition.pushTransparent(layerBack);
            this.composition.pushTransparent(layerFront);
            expect(this.composition.sortTransparentLayers([layerBack.id], [layerFront.id])).to.be.above(0);
            expect(this.composition.sortTransparentLayers([layerFront.id], [layerBack.id])).to.be.below(0);
        });

        it('returns correct value after insertTransparent()', function () {
            const layerFront = new Layer({ id: 2 });
            const layerBack = new Layer({ id: 3 });
            this.composition.insertTransparent(layerFront, 0);
            this.composition.insertTransparent(layerBack, 0);
            expect(this.composition.sortTransparentLayers([layerBack.id], [layerFront.id])).to.be.above(0);
            expect(this.composition.sortTransparentLayers([layerFront.id], [layerBack.id])).to.be.below(0);
        });

        it('returns correct value after removeTransparent()', function () {
            const layerFront = new Layer({ id: 2 });
            const layerMiddle = new Layer({ id: 3 });
            const layerBack = new Layer({ id: 4 });
            this.composition.pushTransparent(layerBack);
            this.composition.pushTransparent(layerMiddle);
            this.composition.pushTransparent(layerFront);
            this.composition.removeTransparent(layerMiddle);
            expect(this.composition.sortTransparentLayers([layerBack.id], [layerFront.id])).to.be.above(0);
            expect(this.composition.sortTransparentLayers([layerFront.id], [layerBack.id])).to.be.below(0);

            // re-add middle layer on top of the front layer
            this.composition.pushTransparent(layerMiddle);
            expect(this.composition.sortTransparentLayers([layerFront.id], [layerMiddle.id])).to.be.above(0);
        });

    });

    describe('#sortOpaqueLayers', function () {

        it('should return negative if the first layers are on top of the second layers', function () {
            const layerFront = new Layer({ id: 2 });
            const layerBack = new Layer({ id: 3 });
            this.composition.push(layerBack);
            this.composition.push(layerFront);
            expect(this.composition.sortOpaqueLayers([layerFront.id], [layerBack.id])).to.be.below(0);
        });

        it('should return negative if one the first layers is on top of the second layers', function () {
            const layerFront = new Layer({ id: 2 });
            const layerMiddle = new Layer({ id: 3 });
            const layerBack = new Layer({ id: 4 });
            this.composition.push(layerBack);
            this.composition.push(layerMiddle);
            this.composition.push(layerFront);
            expect(this.composition.sortOpaqueLayers([layerBack.id, layerFront.id], [layerMiddle.id])).to.be.below(0);
        });

        it('should return negative if second layers not in composition', function () {
            this.composition.push(this.layer);
            expect(this.composition.sortOpaqueLayers([this.layer.id], [2])).to.be.below(0);
        });

        it('should return positive if the second layers are on top of the first layers', function () {
            const layerFront = new Layer({ id: 2 });
            const layerBack = new Layer({ id: 3 });
            this.composition.push(layerBack);
            this.composition.push(layerFront);
            expect(this.composition.sortOpaqueLayers([layerBack.id], [layerFront.id])).to.be.above(0);
        });

        it('should return positive if one the second layers is on top of the first layers', function () {
            const layerFront = new Layer({ id: 2 });
            const layerMiddle = new Layer({ id: 3 });
            const layerBack = new Layer({ id: 4 });
            this.composition.push(layerBack);
            this.composition.push(layerMiddle);
            this.composition.push(layerFront);
            expect(this.composition.sortOpaqueLayers([layerMiddle.id], [layerBack.id, layerFront.id])).to.be.above(0);
        });

        it('should return positive if first layers not in composition', function () {
            this.composition.push(this.layer);
            expect(this.composition.sortOpaqueLayers([2], [this.layer.id])).to.be.above(0);
        });

        it('should return 0 if both layers are the same', function () {
            this.composition.push(this.layer);
            expect(this.composition.sortOpaqueLayers([this.layer.id], [this.layer.id])).to.equal(0);
        });

        it('should return 0 if both layers not in composition', function () {
            expect(this.composition.sortOpaqueLayers([this.layer.id], [this.layer.id])).to.equal(0);
        });

        it('returns correct value after insert()', function () {
            const layerFront = new Layer({ id: 2 });
            const layerBack = new Layer({ id: 3 });
            this.composition.insert(layerFront, 0);
            this.composition.insert(layerBack, 0);
            expect(this.composition.sortOpaqueLayers([layerBack.id], [layerFront.id])).to.be.above(0);
            expect(this.composition.sortOpaqueLayers([layerFront.id], [layerBack.id])).to.be.below(0);
        });

        it('returns correct value after remove()', function () {
            const layerFront = new Layer({ id: 2 });
            const layerMiddle = new Layer({ id: 3 });
            const layerBack = new Layer({ id: 4 });
            this.composition.push(layerBack);
            this.composition.push(layerMiddle);
            this.composition.push(layerFront);
            this.composition.remove(layerMiddle);
            expect(this.composition.sortOpaqueLayers([layerBack.id], [layerFront.id])).to.be.above(0);
            expect(this.composition.sortOpaqueLayers([layerFront.id], [layerBack.id])).to.be.below(0);

            // re-add middle layer on top of the front layer
            this.composition.push(layerMiddle);
            expect(this.composition.sortOpaqueLayers([layerFront.id], [layerMiddle.id])).to.be.above(0);
        });

        it('returns correct value after pushOpaque()', function () {
            const layerFront = new Layer({ id: 2 });
            const layerBack = new Layer({ id: 3 });
            this.composition.pushOpaque(layerBack);
            this.composition.pushOpaque(layerFront);
            expect(this.composition.sortOpaqueLayers([layerBack.id], [layerFront.id])).to.be.above(0);
            expect(this.composition.sortOpaqueLayers([layerFront.id], [layerBack.id])).to.be.below(0);
        });

        it('returns correct value after insertOpaque()', function () {
            const layerFront = new Layer({ id: 2 });
            const layerBack = new Layer({ id: 3 });
            this.composition.insertOpaque(layerFront, 0);
            this.composition.insertOpaque(layerBack, 0);
            expect(this.composition.sortOpaqueLayers([layerBack.id], [layerFront.id])).to.be.above(0);
            expect(this.composition.sortOpaqueLayers([layerFront.id], [layerBack.id])).to.be.below(0);
        });

        it('returns correct value after removeOpaque()', function () {
            const layerFront = new Layer({ id: 2 });
            const layerMiddle = new Layer({ id: 3 });
            const layerBack = new Layer({ id: 4 });
            this.composition.pushOpaque(layerBack);
            this.composition.pushOpaque(layerMiddle);
            this.composition.pushOpaque(layerFront);
            this.composition.removeOpaque(layerMiddle);
            expect(this.composition.sortOpaqueLayers([layerBack.id], [layerFront.id])).to.be.above(0);
            expect(this.composition.sortOpaqueLayers([layerFront.id], [layerBack.id])).to.be.below(0);

            // re-add middle layer on top of the front layer
            this.composition.pushOpaque(layerMiddle);
            expect(this.composition.sortOpaqueLayers([layerFront.id], [layerMiddle.id])).to.be.above(0);
        });

    });

});
