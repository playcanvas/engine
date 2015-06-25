pc.script.create('testcomponent', function() {

	window.results = {

	};

	var states = {
		test1: {
			enter: function() {
				results.test1entered = true;
			},
			update: function(dt) {
				results.iwas = this;
				results.test1time = (results.test1time || 0) + dt;
			},
			doSomething: function() {
				results.test1dosomething = true;
			},
			exit: function() {
				results.test1exited = true;
			}
		},
		test2: {
			enter: function () {
				results.test2entered = true;
			},
			update: function (dt) {
				results.iwas = this;
				results.test2time = (results.test2time || 0) + dt;
			},
			doSomething: function () {
				results.test2dosomething = true;
			}
		}
	};

	var Testcomponent = function(entity) {
		this.entity = entity;
		this.statemachine = new pc.StateMachine(states, this);
	};

	Testcomponent.prototype = {
		update: function(dt) {
			results.testupdatetime = dt + (results.testupdatetime || 0);
		}
	};

	return Testcomponent;

});
