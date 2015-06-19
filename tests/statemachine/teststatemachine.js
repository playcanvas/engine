var entity;
var app;
app = new pc.Application(document.getElementById('canvas'), {});
app.start();

module('pc.StateMachine', {

	setup: function() {
		entity = new pc.Entity(app);
		stop();
		var script = entity.addComponent('script', { scripts: [{url: 'scripts/testcomponent.js'}] });
		setTimeout(function() {
			QUnit.start();
		}, 100);
	},
	teardown: function() {
		entity = null;
	}

});

test('Entity was created', function(assert) {
	QUnit.assert.notEqual(entity, null, "Entity not created");
});

test('Current state is <none>', function() {
	equal(entity.script.testcomponent.statemachine.state, '<none>');
});

test('State change is reflected in state', function() {
	stop();
	entity.script.testcomponent.statemachine.state = 'test1';
	equal(entity.script.testcomponent.statemachine.state, 'test1', "State was test1");
	equal(window.results.test1entered, true, "Test1 was entered");
	entity.script.testcomponent.statemachine.state = 'test2';
	equal(entity.script.testcomponent.statemachine.state, 'test2', "State was test2");
	equal(window.results.test2entered, true, "Test2 was entered");
	equal(window.results.test1exited, true, "Test1 was exited");
	setTimeout(function() {
		ok(window.results.testupdatetime > 1, "Normal update passed 1 second");
		ok(window.results.test2time > 1, "State machine update passed 1 second");
		ok(window.results.iwas == entity.script.testcomponent, "Bound to correct object");
		start();
	}, 1400);
});

test('Call a special method', function() {
	entity.script.testcomponent.statemachine.state = 'test1';
	entity.script.testcomponent.doSomething();
	equal(window.results.test1dosomething, true, "Test1 was called");
	notEqual(window.results.test2dosomething, true, "Test2 was not called");
	results.test1dosomething = false;
	results.test2dosomething = false;
	entity.script.testcomponent.statemachine.state = 'test2';
	entity.script.testcomponent.doSomething();
	equal(window.results.test2dosomething, true, "Test2 was called");
	notEqual(window.results.test1dosomething, true, "Test1 was not called");


});

