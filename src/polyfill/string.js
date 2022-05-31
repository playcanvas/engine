import { defineProtoFunc } from "./defineProtoFunc.js";

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith#Polyfill
defineProtoFunc(String, 'endsWith', function (search, this_len) {
    if (this_len === undefined || this_len > this.length) {
        this_len = this.length;
    }
    return this.substring(this_len - search.length, this_len) === search;
});

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes#Polyfill
defineProtoFunc(String, 'includes', function (search, start) {
    'use strict';
    if (typeof start !== 'number') {
        start = 0;
    }

    if (start + search.length > this.length) {
        return false;
    } else {
        return this.indexOf(search, start) !== -1;
    }
});

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith#Polyfill
defineProtoFunc(String, 'startsWith', function(search, rawPos) {
    var pos = rawPos > 0 ? rawPos|0 : 0;
    return this.substring(pos, pos + search.length) === search;
});

// https://vanillajstoolkit.com/polyfills/stringtrimend/
defineProtoFunc(String, 'trimEnd', function () {
    return this.replace(new RegExp(/[\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF]+/.source + '$', 'g'), '');
});
