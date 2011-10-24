// requestAnimFrame shim layer by Paul Irish
// Support for element visibility and window blur detection by Juerg Lehni

(function() {
	// Chrome shipped without the time arg in m10
	var webkitRequest = window.webkitRequestAnimationFrame;
	if (webkitRequest) {
		webkitRequest(function(time) {
			if (time == undefined)
				webkitRequest = null;
		});
	}

	window.requestAnimFrame = (function() {
		var request = window.requestAnimationFrame || webkitRequest || 
			window.mozRequestAnimationFrame || 
			window.oRequestAnimationFrame || 
			window.msRequestAnimationFrame;
		if (request)
			return request;

		// So we need to fake it. Define helper functions first:

		// Checks if element is visibile in current viewport
		function isVisible(element) {
			var doc = document.getElementsByTagName(
					document.compatMode == 'CSS1Compat' ? 'html' : 'body')[0],
				rect1 = {
					x: window.pageXOffset || doc.scrollLeft,
					y: window.pageYOffset || doc.scrollTop,
					width: window.innerWidth || doc.clientWidth,
					height: window.innerHeight || doc.clientHeight
				},
				rect2 = {
					x: 0, y: 0,
					width: element.offsetWidth,
					height: element.offsetHeight
				};
			// Add offsets
			for (var el = element; el;
				rect2.x += el.offsetLeft, rect2.y += el.offsetTop,
				el = el.offsetParent) {}
			// See if the two rectangle intersect
			return rect1.x + rect1.width > rect2.x
					&& rect1.y + rect1.height > rect2.y
					&& rect1.x < rect2.x + rect2.width
					&& rect1.y < rect2.y + rect2.height;
		}

		// Installs event listeners on the window
		function addEvent(type, func) {
			if (window.addEventListener) {
				addEventListener(type, func, false);
			} else if (window.attachEvent) {
				attachEvent('on' + type, func);
			}
		}

		var focused = true;
		addEvent('focus', function() {
			focused = true;
		});
		addEvent('blur', function() {
			focused = false;
		});
		return function(callback, element) {
			window.setTimeout(function() {
				callback(+new Date);
			}, focused && (!element || isVisible(element)) ? 1000 / 60 : 1000);
		};
	})();
})();