import { EventHandler } from '../../src/core/event-handler.js';

import { expect } from 'chai';

describe('EventHandler', function () {

    describe('#hasEvent', function () {

        it('returns true if the event is registered', function () {
            const e = new EventHandler();
            e.on('test', function () { });
            expect(e.hasEvent('test')).to.be.true;
        });

        it('returns false if the event is not registered', function () {
            const e = new EventHandler();
            e.on('test', function () { });
            expect(e.hasEvent('hello')).to.be.false;
        });

    });

    describe('#on', function () {

        it('calls handler on fire', function () {
            const e = new EventHandler();
            let called = false;
            e.on('test', () => {
                called = true;
            });
            e.fire('test');
            expect(called).to.be.true;
        });

        it('calls handler with up to 8 arguments on fire', function () {
            const e = new EventHandler();
            let called = false;
            e.on('test', (arg1, arg2, arg3, arg4, arg5, arg6, arg7, arg8, arg9) => {
                called = true;
                expect(arg1).to.equal(1);
                expect(arg2).to.equal(2);
                expect(arg3).to.equal(3);
                expect(arg4).to.equal(4);
                expect(arg5).to.equal(5);
                expect(arg6).to.equal(6);
                expect(arg7).to.equal(7);
                expect(arg8).to.equal(8);
                expect(arg9).to.be.undefined;
            });
            e.fire('test', 1, 2, 3, 4, 5, 6, 7, 8, 9);
            expect(called).to.be.true;
        });

    });

    describe('#once', function () {

        it('unregisters itself after the first fire', function () {
            const e = new EventHandler();
            let count = 0;
            e.once('test', () => {
                count++;
            });
            expect(e.hasEvent('test')).to.be.true;
            e.fire('test');
            expect(e.hasEvent('test')).to.be.false;
            e.fire('test');
            expect(count).to.equal(1);
        });

    });

    describe('#off', function () {

        it('unregisters event handler with specified callback and scope', function () {
            const e = new EventHandler();
            let called = false;
            const callback = function () {
                called = true;
            };
            e.on('test', callback, this);
            expect(e.hasEvent('test')).to.be.true;
            e.off('test', callback, this);
            expect(e.hasEvent('test')).to.be.false;
            e.fire('test');
            expect(called).to.be.false;
        });

        it('unregisters event handler with specified callback', function () {
            const e = new EventHandler();
            let called = false;
            const callback = function () {
                called = true;
            };
            e.on('test', callback);
            expect(e.hasEvent('test')).to.be.true;
            e.off('test', callback);
            expect(e.hasEvent('test')).to.be.false;
            e.fire('test');
            expect(called).to.be.false;
        });

        it('unregisters all event handlers', function () {
            const e = new EventHandler();
            let called = false;
            e.on('test', function () {
                called = true;
            });
            expect(e.hasEvent('test')).to.be.true;
            e.off();
            expect(e.hasEvent('test')).to.be.false;
            e.fire('test');
            expect(called).to.be.false;
        });

    });

});
