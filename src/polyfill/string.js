import { defineProtoFunc } from "./defineProtoFunc.js";

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith#Polyfill
defineProtoFunc(String, 'endsWith', function(search, this_len) {
    if (this_len === undefined || this_len > this.length) {
        this_len = this.length;
    }
    return this.substring(this_len - search.length, this_len) === search;
});

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes#Polyfill
defineProtoFunc(String, 'includes', function(search, start) {
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
    const pos = rawPos > 0 ? rawPos|0 : 0;
    return this.substring(pos, pos + search.length) === search;
});
