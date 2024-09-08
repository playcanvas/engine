import { AnimEvents } from '../../../../src/framework/anim/evaluator/anim-events.js';
import { expect } from 'chai';

describe('AnimEvents', function () {
    const animEvents = new AnimEvents([
        {
            name: 'event2',
            time: 1.5,
            property: true
        },
        {
            name: 'event1',
            time: 0.5,
            property: false
        }
    ]);

    describe('#constructor', function () {

        it('instantiates correctly', function () {
            expect(animEvents).to.be.ok;
        });

    });

    describe('#constructor', function () {

        it('sorts the events', function () {
            expect(animEvents.events[0].name).to.equal('event1');
            expect(animEvents.events[1].name).to.equal('event2');
        });

    });

    describe('#events', function () {

        it('returns the events stored in the instance', function () {
            expect(animEvents.events[0].name).to.equal('event1');
            expect(animEvents.events[0].time).to.equal(0.5);
            expect(animEvents.events[0].property).to.equal(false);
            expect(animEvents.events[1].name).to.equal('event2');
            expect(animEvents.events[1].time).to.equal(1.5);
            expect(animEvents.events[1].property).to.equal(true);
        });

    });

});
