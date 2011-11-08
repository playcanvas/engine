pc.extend(pc.input, function () {    

    /**
     * @name pc.input.MouseEvent
     * @class The object passed into Mouse Event handlers
     * @params {Object} [options] Data used to initialize the fields of the Event. See the fields for details 
     */
    var MouseEvent = function (options) {
        options = options || {};
        /**
         * @field
         * @name pc.input.MouseEvent#type
         * @description Type of the mouse event: pc.input.EVENT_MOUSE_UP, pc.input.EVENT_MOUSE_DOWN, pc.input.EVENT_MOUSE_MOVE, pc.input.EVENT_MOUSE_WHEEL 
         */
        this.type = options.type || "";
        //this.positionX = options.positionX || 0;
        //this.positionY = options.positionY || 0;
        
        /**
         * @field
         * @name pc.input.MouseEvent#x
         * @description Horizontal co-ordinate of the event, relative to the DOM Element the Mouse object is attached to, often the canvas element.
         */
        this.x = options.x || 0;
        /**
         * @field
         * @name pc.input.MouseEvent#y
         * @description Vertical co-ordinate of the event, relative to the DOM Element the Mouse object is attached to, often the canvas element.
         */
        this.y = options.y || 0;
        
        /**
         * @field
         * @name pc.input.MouseEvent#deltaX
         * @description Change in horizonal co-ordinate value since the last event, only valid for pc.input.EVENT_MOUSE_MOVE
         */
        this.deltaX = options.deltaX || 0;
        /**
         * @field
         * @name pc.input.MouseEvent#deltaY
         * @description Change in vertical co-ordinate value since the last event, only valid for pc.input.EVENT_MOUSE_MOVE
         */
        this.deltaY = options.deltaY || 0;
        
        /**
         * @field
         * @name pc.input.MouseEvent#deltaWheel
         * @description Change in value of the mouse wheel since the last event. This is a normalized value in the range -1 to 1. 
         */
        this.deltaWheel = options.deltaWheel || 0;
        
        /**
         * @field
         * @name pc.input.MouseEvent#button
         * @description The individual button to which the event refers. Only valid for pc.input.EVENT_MOUSE_UP and pc.input.EVENT_MOUSE_DOWN
         */
        this.button = pc.isDefined(options.button) ? options.button : pc.input.MOUSE_BUTTON_NONE;
        
        /**
         * @field
         * @name pc.input.MouseEvent#buttons
         * @description Boolean array of button states. A value of true indicates the button is currently pressed. 
         * The array is in this order [pc.input.MOUSE_BUTTON_LEFT, pc.input.MOUSE_BUTTON_MIDDLE, pc.input.MOUSE_BUTTON_RIGHT] 
         */
        this.buttons = options.buttons || [false, false, false];
        
        /**
         * @field
         * @name pc.input.MouseEvent#event
         * @description The original DOM MouseEvent
         */
        this.event = options.event || null;
    };
    /**
     * Create a new Mouse object
     * @class Capture and respond to mouse events.
     * @param {DOMElement} [element] The DOMElement that the mouse events are attached to
     * @name pc.input.Mouse
     */
    var Mouse = function(element) {
            // Clear the mouse state
            this._positionY    = 0;
            this._positionX    = 0;
            this._offsetX      = 0;
            this._offsetY      = 0;
            this._deltaX       = 0;
            this._deltaY       = 0;
            this._buttons      = [false,false,false];
            this._lastbuttons  = [];
            
            this._upHandler = pc.callback(this, this._handleUp);
            this._downHandler = pc.callback(this, this._handleDown);
            this._moveHandler = pc.callback(this, this._handleMove);
            this._wheelHandler = pc.callback(this, this._handleWheel);
            this._contextMenuHandler = function (event) { event.preventDefault(); };
            
            this._element = null;
            
            if(element) {
                this.attach(element);
            }
            
            // Add events
            pc.extend(this, pc.events);
        };
    
    /**
     * @function
     * @name pc.input.Mouse#attach
     * @description Attach mouse events to a DOMElement.
     * @param {Object} element
     */
    Mouse.prototype.attach = function (element) {
        // Store which DOM element the mouse is handling
        this._element = element;
    
        this._element.addEventListener("mouseup", this._upHandler, false);
        this._element.addEventListener("mousedown", this._downHandler, false);
        this._element.addEventListener("mousemove", this._moveHandler, false);
        this._element.addEventListener("mousewheel", this._wheelHandler, false); // WekKit
        this._element.addEventListener("DOMMouseScroll", this._wheelHandler, false); // Gecko        
    };
    
    /**
     * @function
     * @name pc.input.Mouse#detach
     * @description Remove mouse events from the DOMElement
     */
    Mouse.prototype.detach = function () {
        this._element.removeEventListener("mouseup", this._upHandler);
        this._element.removeEventListener("mousedown", this._downHandler);
        this._element.removeEventListener("mousemove", this._moveHandler);
        this._element.removeEventListener("mousewheel", this._wheelHandler); // WekKit
        this._element.removeEventListener("DOMMouseScroll", this._wheelHandler); // Gecko                
        
        this._element = null;
    };
    
    /**
     * @function
     * @name pc.input.Mouse#disableContextMenu
     * @description Disable the context menu usually activated with right-click
     */
    Mouse.prototype.disableContextMenu = function () {
        this._element.addEventListener("contextmenu", this._contextMenuHandler);        
    };
    
    /**
     * @function
     * @name pc.input.Mouse#enableContextMenu
     * @description Enable the context menu usually activated with right-click. This option is active by default.
     */
    Mouse.prototype.enableContextMenu = function () {
        this._element.removeEventListener("contextmenu", this._contextMenuHandler);    
    };
    
    /**
     * @function
     * @name pc.input.Mouse#update
     * @description Update method, should be called once per frame
     * @param {Object} dt
     */
    Mouse.prototype.update = function (dt) {
        // Copy current button state
        this._lastbuttons = this._buttons.slice(0);
    };
    
    /**
     * @function
     * @name pc.input.Mouse#isPressed
     * @description Returns true if the mouse button is currently pressed
     * @param {Object} button
     */
    Mouse.prototype.isPressed = function (button) {
        return this._buttons[button];
    };
    
    /**
     * @function
     * @name pc.input.Mouse#wasPressed
     * @description Returns true if the mouse button was pressed this frame (since the last call to update).
     * @param {Object} button
     */
    Mouse.prototype.wasPressed = function (button) {
        return (this._buttons[button] && !this._lastbuttons[button]);
    };
    
    Mouse.prototype._handleUp = function (event) {
        // disable released button
        this._buttons[event.button] = false;
        
        // send 'mouseup' event
        this.fire(pc.input.EVENT_MOUSE_UP, new MouseEvent({
            type: pc.input.EVENT_MOUSE_UP,
            positionX: this._positionX,
            positionY: this._positionY,
            x: this._offsetX,
            y: this._offsetY,
            button: event.button,
            buttons: this._buttons,
            event: event
        }));
    };
    
    Mouse.prototype._handleDown = function (event) {
        // Store which button has affected
        this._buttons[event.button] = true;    

        this.fire(pc.input.EVENT_MOUSE_DOWN, new MouseEvent({
            type: pc.input.EVENT_MOUSE_DOWN,
            positionX: this._positionX,
            positionY: this._positionY,
            x: this._offsetX,
            y: this._offsetY,
            button: event.button,
            buttons: this._buttons,
            event: event
        }));
    };
    
    Mouse.prototype._handleMove = function (event) {
        // Calculate the mouse movement
        this._deltaX = event.clientX - this._positionX;
        this._deltaY = event.clientY - this._positionY;
    
        // Update the current position
        this._positionX = event.clientX;
        this._positionY = event.clientY;
        offset = pc.input.getOffsetCoords(event);
        this._offsetX = offset.x;
        this._offsetY = offset.y;
        
        this.fire(pc.input.EVENT_MOUSE_MOVE, new MouseEvent({
            type: pc.input.EVENT_MOUSE_MOVE,
            positionX: this._positionX,
            positionY: this._positionY,
            x: this._offsetX,
            y: this._offsetY,
            deltaX: this._deltaX,
            deltaY: this._deltaY,
            buttons: this._buttons,
            event: event
        }));
    };
    
    Mouse.prototype._handleWheel = function (event) {    
        // Store the wheel movement
        if(event.wheelDelta) {
            this.deltaWheel = event.wheelDelta / 120; // Convert to -1 to 1
        } else {
            this.deltaWheel = event.detail / -3; // Convert to -1 to 1
        }
        
        this.fire(pc.input.EVENT_MOUSE_WHEEL, new MouseEvent({
            type: pc.input.EVENT_MOUSE_WHEEL,
            positionX: this._positionX,
            positionY: this._positionY,
            x: this._offsetX,
            y: this._offsetY,
            deltaWheel: this.deltaWheel,
            buttons: this._buttons,
            event: event
        }));
    };
    
    
    
    // Public Interface
    return  {
        /**
         * @name pc.input.EVENT_MOUSE_UP
         * @description Name of mouse up event
         */
        EVENT_MOUSE_UP: "mouseup",
        EVENT_MOUSE_DOWN: "mousedown",
        EVENT_MOUSE_MOVE: "mousemove",
        EVENT_MOUSE_WHEEL: "mousewheel",
        
        /**
         * @name pc.input.MOUSE_BUTTON_NONE
         * @description Value of pc.input.MouseEvent#button when no mouse button is pressed
         */
        MOUSE_BUTTON_NONE: -1,
        MOUSE_BUTTON_LEFT: 0,
        MOUSE_BUTTON_MIDDLE: 1,
        MOUSE_BUTTON_RIGHT: 2,
        
        Mouse: Mouse,
        MouseEvent: MouseEvent,
        /**
         * @private
         * @function
         * @name pc.input.getOffsetCoords
         * @description offsetX/Y are not cross-browser compatible so we generate a set of offset coords here
         * from pageX/Y which are the same on all browsers 
         * @param {MouseEvent} event
         */
        getOffsetCoords: function getOffsetCoords(event) {
            var coords = { x: 0, y: 0};
    
            var element = event.target ;
            var totalOffsetLeft = 0;
            var totalOffsetTop = 0 ;
    
            while (element.offsetParent)
            {
                totalOffsetLeft += element.offsetLeft;
                totalOffsetTop += element.offsetTop;
                element = element.offsetParent;
            }
            coords.x = event.pageX - totalOffsetLeft;
            coords.y = event.pageY - totalOffsetTop;
            
            return coords;
        }
    };
} ());


