pc.extend(pc.input, function () {
    /**
    * @name pc.input.GamePads
    * @class Input handler for access GamePad input
    */ 
    var GamePads = function () {
        this.gamepadsSupported = !!navigator.webkitGetGamepads;

        this.current = [];
        this.previous = [];

        this.deadZone = 0.25;
    };

    var MAPS = {
        DEFAULT: {
            buttons: [
                // Face buttons
                'PAD_FACE_1',
                'PAD_FACE_2',
                'PAD_FACE_3',
                'PAD_FACE_4',
               
                // Shoulder buttons
                'PAD_L_SHOULDER_1',
                'PAD_R_SHOULDER_1',
                'PAD_L_SHOULDER_2',
                'PAD_R_SHOULDER_2',

                // Other buttons
                'PAD_SELECT',
                'PAD_START',
                'PAD_L_STICK_BUTTON',
                'PAD_R_STICK_BUTTON',

                // D Pad
                'PAD_UP',
                'PAD_DOWN',
                'PAD_LEFT',
                'PAD_RIGHT',

                 // Vendor specific button
                'PAD_VENDOR'
            ],

            axes: [
                // Analogue Sticks
                'PAD_L_STICK_X',
                'PAD_L_STICK_Y',
                'PAD_R_STICK_X',
                'PAD_R_STICK_Y'
            ]
        },

        PS3: {
            buttons: [
                // X, O, TRI, SQ
                'PAD_FACE_1',
                'PAD_FACE_2',
                'PAD_FACE_4',
                'PAD_FACE_3',

                // Shoulder buttons
                'PAD_L_SHOULDER_1',
                'PAD_R_SHOULDER_1',
                'PAD_L_SHOULDER_2',
                'PAD_R_SHOULDER_2',

                // Other buttons
                'PAD_SELECT',
                'PAD_START',
                'PAD_L_STICK_BUTTON',
                'PAD_R_STICK_BUTTON',

                // D Pad
                'PAD_UP',
                'PAD_DOWN',
                'PAD_LEFT',
                'PAD_RIGHT',

                'PAD_VENDOR'
            ],

            axes: [
                // Analogue Sticks
                'PAD_L_STICK_X',
                'PAD_L_STICK_Y',
                'PAD_R_STICK_X',
                'PAD_R_STICK_Y'
            ]
        }
    };

    var PRODUCT_CODES = {
        'Product: 0268': 'PS3'
    };

    GamePads.prototype = {
        /**
        * @function
        * @name pc.input.GamePads#update
        * @description Update the current and previous state of the gamepads. This must be called every frame for wasPressed()
        * to work
        */
        update: function (dt) {
            var pads = this.poll();

            var i, len = pads.length;
            for (i = 0;i < len; i++) {
                this.previous[i] = this.current[i];
                this.current[i] = pads[i];
            }            
        },

        /**
        * @function
        * @name pc.input.GamePads#poll
        * @description Poll for the latest data from the gamepad API.
        * @returns {Array} An array of gamepads and mappings for the model of gamepad that is attached
        * @example
        *   var gamepad = new pc.input.GamePad();
        *   var pads = gamepad.poll();
        *   // pads[0] = { map: <map>, pad: <pad> }
        */
        poll: function () {
            var pads = [];
            if (this.gamepadsSupported) {
                var padDevices = navigator.webkitGetGamepads();
                var i, len = padDevices.length;
                for (i = 0; i < len; i++) {
                    if (padDevices[i]) {
                        pads.push({
                            map: this.getMap(padDevices[i]),
                            pad: padDevices[i]
                        });
                    }
                }
            }
            return pads;
        },

        getMap: function (pad) {
            for (var code in PRODUCT_CODES) {
                if (pad.id.indexOf(code) >= 0) {
                    return MAPS[PRODUCT_CODES[code]];
                }
            }

            return MAPS.DEFAULT;
        },

        /**
        * @function
        * @name pc.input.GamePads#isPressed
        * @description Returns true if the button on the pad requested is pressed
        * @param {Number} index The index of the pad to check, use constants pc.input.PAD_1, pc.input.PAD_2, etc
        * @param {Number} button The button to test, use constants pc.input.PAD_FACE_1, etc
        * @returns {Boolean} True if the button is pressed
        */
        isPressed: function (index, button) {
            if (!this.current[index]) {
                return false;
            }

            var key = this.current[index].map.buttons[button];
            return this.current[index].pad.buttons[pc.input[key]];
        },

        /**
        * @function
        * @name pc.input.GamePads#wasPressed
        * @description Returns true if the button was pressed since the last frame
        * @param {Number} index The index of the pad to check, use constants pc.input.PAD_1, pc.input.PAD_2, etc
        * @param {Number} button The button to test, use constants pc.input.PAD_FACE_1, etc
        * @returns {Boolean} True if the button was pressed since the last frame
        */
        wasPressed: function (index, button) {
            if (!this.current[index]) {
                return false;
            }

            var key = this.current[index].map.buttons[button];
            var i = pc.input[key];
            return this.current[index].pad.buttons[i] && !this.previous[index].pad.buttons[i];
        },

        /**
        * @function
        * @name pc.input.GamePads#getAxis
        * @description Get the value of one of the analogue axes of the pad
        * @param {Number} index The index of the pad to check, use constants pc.input.PAD_1, pc.input.PAD_2, etc
        * @param {Number} axes The axes to get the value of, use constants pc.input.PAD_L_STICK_X, etc
        * @returns {Number} The value of the axis between -1 and 1.
        */
        getAxis: function (index, axes) {
            if (!this.current[index]) {
                return false;
            }

            var key = this.current[index].map.axes[axes];
            var value = this.current[index].pad.axes[pc.input[key]];

            if (Math.abs(value) < this.deadZone) {
                value = 0;
            }
            return value;
        }
    };

    return {    
        /** 
        * @description Index for pad 1
        */
        PAD_1: 0,
        /** 
        * @description Index for pad 2
        */
        PAD_2: 1,
        /** 
        * @description Index for pad 3
        */
        PAD_3: 2,
        /** 
        * @description Index for pad 4
        */
        PAD_4: 3,

        /** 
        * @description The first face button, from bottom going clockwise
        */
        PAD_FACE_1: 0,
        /** 
        * @description The second face button, from bottom going clockwise
        */
        PAD_FACE_2: 1,
        /** 
        * @description The third face button, from bottom going clockwise
        */
        PAD_FACE_3: 2,
        /** 
        * @description The fourth face button, from bottom going clockwise
        */
        PAD_FACE_4: 3,


        /** 
        * @description The first shoulder button on the left
        */
        PAD_L_SHOULDER_1: 4,
        /** 
        * @description The first shoulder button on the right
        */
        PAD_R_SHOULDER_1: 5,
        /** 
        * @description The second shoulder button on the left
        */
        PAD_L_SHOULDER_2: 6,
        /** 
        * @description The second shoulder button on the right
        */
        PAD_R_SHOULDER_2: 7,

        /** 
        * @description The select button
        */
        PAD_SELECT: 8,
        /** 
        * @description The start button
        */
        PAD_START: 9,

        /** 
        * @description The button when depressing the left analogue stick
        */
        PAD_L_STICK_BUTTON: 10,
        /** 
        * @description The button when depressing the right analogue stick
        */
        PAD_R_STICK_BUTTON: 11,

        /** 
        * @description Direction pad up
        */
        PAD_UP: 12,
        /** 
        * @description Direction pad down
        */
        PAD_DOWN: 13,
        /** 
        * @description Direction pad left
        */
        PAD_LEFT: 14,
        /** 
        * @description Direction pad right
        */
        PAD_RIGHT: 15,

        /** 
        * @description Vendor specific button
        */
        PAD_VENDOR: 16,

        /** 
        * @description Horizontal axis on the left analogue stick
        */
        PAD_L_STICK_X: 0,
        /** 
        * @description Vertical axis on the left analogue stick
        */
        PAD_L_STICK_Y: 1,
        /** 
        * @description Horizontal axis on the right analogue stick
        */
        PAD_R_STICK_X: 2,
        /** 
        * @description Vertical axis on the right analogue stick
        */
        PAD_R_STICK_Y: 3,

        GamePads: GamePads
    };
}());
