import { expect } from 'chai';

import { EventHandler } from '../../src/core/event-handler.js';

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
            e.on('test', function () {
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
            e.once('test', function () {
                count++;
            });
            expect(e.hasEvent('test')).to.be.true;
            e.fire('test');
            expect(e.hasEvent('test')).to.be.false;
            e.fire('test');
            expect(count).to.equal(1);
        });

        it('calls a listener only once when it fires the same event', function () {
            const e = new EventHandler();
            let count = 0;
            const handle = e.once('test', function () {
                count++;
                if (count === 1) {
                    e.fire('test');
                }
            });

            e.fire('test');
            expect(count).to.equal(1);
            expect(handle.removed).to.be.true;
            expect(e.hasEvent('test')).to.be.false;
        });

        it('does not repeat a listener consumed by a nested fire', function () {
            const e = new EventHandler();
            const calls = [];
            e.on('test', function (value) {
                calls.push(`on:${value}`);
                if (value === 'outer') {
                    e.fire('test', 'inner');
                }
            });
            e.once('test', value => calls.push(`once:${value}`));

            e.fire('test', 'outer');
            expect(calls).to.deep.equal(['on:outer', 'on:inner', 'once:inner']);
        });

        it('calls each once listener only once across nested fires', function () {
            const e = new EventHandler();
            const calls = [];
            e.once('test', function (value) {
                calls.push(`a:${value}`);
                if (value === 'outer') {
                    e.fire('test', 'inner');
                }
            });
            e.once('test', value => calls.push(`b:${value}`));

            e.fire('test', 'outer');
            expect(calls).to.deep.equal(['a:outer', 'b:inner']);
            expect(e.hasEvent('test')).to.be.false;
        });

        it('removes a once listener even when its callback throws', function () {
            const e = new EventHandler();
            const error = new Error('listener failed');
            let count = 0;
            const handle = e.once('test', function () {
                count++;
                throw error;
            });

            expect(() => e.fire('test')).to.throw(error);
            expect(handle.removed).to.be.true;
            expect(e.hasEvent('test')).to.be.false;
            e.fire('test');
            expect(count).to.equal(1);
        });

    });

    describe('#fire', function () {

        it('finishes the outer listeners after a nested fire', function () {
            const e = new EventHandler();
            const calls = [];
            const scope = {};
            e.on('test', function (value) {
                expect(this).to.equal(scope);
                calls.push(`a:${value}`);
                if (value === 'outer') {
                    e.fire('test', 'inner');
                }
            }, scope);
            e.on('test', value => calls.push(`b:${value}`));

            expect(e.fire('test', 'outer')).to.equal(e);
            expect(calls).to.deep.equal(['a:outer', 'a:inner', 'b:inner', 'b:outer']);
        });

        it('preserves each active listener list when a nested listener removes another', function () {
            const e = new EventHandler();
            const calls = [];
            let handle = null;
            e.on('test', function (value) {
                calls.push(`a:${value}`);
                if (value === 'outer') {
                    e.fire('test', 'inner');
                } else if (value === 'inner') {
                    handle.off();
                }
            });
            handle = e.on('test', value => calls.push(`b:${value}`));

            e.fire('test', 'outer');
            e.fire('test', 'later');
            expect(calls).to.deep.equal(['a:outer', 'a:inner', 'b:inner', 'b:outer', 'a:later']);
        });

        it('includes newly added listeners in nested fires but not the outer fire', function () {
            const e = new EventHandler();
            const calls = [];
            e.on('test', function (value) {
                calls.push(`a:${value}`);
                if (value === 'outer') {
                    e.on('test', value => calls.push(`c:${value}`));
                    e.fire('test', 'inner');
                }
            });
            e.on('test', value => calls.push(`b:${value}`));

            e.fire('test', 'outer');
            expect(calls).to.deep.equal(['a:outer', 'a:inner', 'b:inner', 'c:inner', 'b:outer']);
        });

        it('starts a fresh listener list after a callback throws', function () {
            const e = new EventHandler();
            const error = new Error('listener failed');
            const calls = [];
            e.on('test', function () {
                calls.push('throw');
                throw error;
            });
            e.on('test', () => calls.push('old'));

            expect(() => e.fire('test')).to.throw(error);
            e.off('test');
            e.on('test', () => calls.push('new'));
            e.fire('test');
            expect(calls).to.deep.equal(['throw', 'new']);
        });

        it('still calls a once listener removed during the current fire', function () {
            const e = new EventHandler();
            const calls = [];
            let handle = null;
            e.on('test', function () {
                calls.push('on');
                handle.off();
            });
            handle = e.once('test', () => calls.push('once'));

            e.fire('test');
            e.fire('test');
            expect(calls).to.deep.equal(['on', 'once', 'on']);
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
