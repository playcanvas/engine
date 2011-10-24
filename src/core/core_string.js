/**
 * @name pc.string
 * @namespace Extended common string functions
 */
pc.string = function () {
    return {
        /**
         * @name pc.string.ASCII_LOWERCASE
         * @description All lowercase letters
         */
        ASCII_LOWERCASE: "abcdefghijklmnopqrstuvwxyz",

        /**
         * @name pc.string.ASCII_UPPERCASE
         * @description All uppercase letters
         */
        ASCII_UPPERCASE: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",

        /**
         * @name pc.string.ASCII_LETTERS
         * @description All ASCII letters
         */
        ASCII_LETTERS: this.ASCII_LOWERCASE + this.ASCII_UPPERCASE,
        /**
         * @function
         * @name pc.string.format
         * @description Return a string with {n} replaced with the n-th argument
         * @param {String} s The string to format
         * @param {Object} [arguments] All other arguments are substituted into the string
         */
        format: function (s) {
            var i = 0,
            regexp,
            args = pc.makeArray(arguments);
            
            // drop first argument
            args.shift();
            
            for (i = 0; i < args.length; i++) {
                regexp = new RegExp('\\{' + i + '\\}', 'gi');
                s = s.replace(regexp, args[i]);
            }
            return s;
        },
        
        startsWith: function (s, subs) {
            return (s.indexOf(subs) === 0);
        },
                
        endsWith: function (s, subs) {
            return (s.lastIndexOf(subs, s.length - subs.length) !== -1);    
        }

    };
} ();

