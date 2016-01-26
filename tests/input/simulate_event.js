function simulate(element, eventName) {
    var defaults = extend({}, defaultOptions);
    var options = extend(defaults, arguments[2] || {});
    var oEvent, eventType = null;

    for (var name in eventMatchers) {
        if (eventMatchers[name].test(eventName)) { eventType = name; break; }
    }

    if (!eventType) {
        throw new SyntaxError('Only HTMLEvents and MouseEvents interfaces are supported');
    }

    if (document.createEvent) {
        oEvent = document.createEvent(eventType);
        if (eventType == 'HTMLEvents') {
            oEvent.initEvent(eventName, options.bubbles, options.cancelable);
        }
        else if (eventType === 'MouseEvents') {
            oEvent.initMouseEvent(eventName, options.bubbles, options.cancelable, document.defaultView, options.detail, options.pointerX, options.pointerY, options.pointerX, options.pointerY, options.ctrlKey, options.altKey, options.shiftKey, options.metaKey, options.button, element);
        } else if (eventType === 'KeyboardEvent') {
            defaults = extend({}, defaultKeyboardOptions);
            options = extend(defaults, arguments[2] || {});
            if (oEvent.initKeyEvent) {
                oEvent.initKeyEvent(eventName, options.bubbles, options.cancelable, document.defaultView, options.ctrl, options.shift, options.alt, options.meta, options.keyCode, options.charCode);
            } else {
                oEvent = document.createEvent("Events");
                // initKeyboardEvent doesn't work property in Chrome, fudge it using plain event
                oEvent.initEvent(eventName, options.bubbles, options.cancelable);
                oEvent.keyCode = options.keyCode;
                oEvent.which = options.keyCode;
            }
        }

        element.dispatchEvent(oEvent);
    } else {
        options.clientX = options.pointerX;
        options.clientY = options.pointerY;
        var evt = document.createEventObject();
        oEvent = extend(evt, options);
        element.fireEvent('on' + eventName, oEvent);
    }
    return element;
}

function extend(destination, source) {
    for (var property in source)
      destination[property] = source[property];
    return destination;
}

var eventMatchers = {
    'HTMLEvents': /^(?:load|unload|abort|error|select|change|submit|reset|focus|blur|resize|scroll)$/,
    'MouseEvents': /^(?:click|dblclick|mouse(?:down|up|over|move|out|wheel))$/,
    'KeyboardEvent': /^(?:keydown|keypress|keyup)$/
};

var defaultOptions = {
    pointerX: 16,
    pointerY: 16,
    detail: 0,
    button: 0,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    bubbles: true,
    cancelable: true
};

var defaultKeyboardOptions = {
    bubbles: true,
    cancelable: true,
    charCode: 0,
    keyCode: 0,
    location: 0,
    modifiers: '',
    repeat: false,
    locale: '',
    ctrl: false,
    alt: false,
    shift: false,
    meta: false
};
