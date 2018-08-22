/**
 * Converter from Arabic to Arabic Presentation Forms-B
 * http://en.wikipedia.org/wiki/Arabic_(Unicode_block)
 * http://en.wikipedia.org/wiki/Arabic_Presentation_Forms-B
 *
 * Usage:
 * var arabicFormBText = arabicConverter.convertArabic(arabicText);
 * var arabicText = convertArabicBack.convertArabic(arabicFormBText);
 *
 * @link https://github.com/lamerw/Arabic-Converter-From-and-To-Arabic-Presentation-Forms-B
 */
(function (root, factory) {
    "use strict";
    /* global define:true */
    if (typeof define === 'function' && define.amd) {
        // AMD
        define([], factory);
    } else if (typeof exports === 'object') {
        // CommonJS
        module.exports = factory();
    } else {
        //Module pattern
        root.arabicConverter = factory();
    }
}(this, function () {
    "use strict";


    /**
     * @private
     * @type {number}
     */
    var NIL = 0x0000;

    /**
     * @TODO replace with charsMap.length
     * @private
     * @type {number}
     */
    var MAP_LENGTH = 37;

    /**
     * @TODO replace with combCharsMap.length
     * @private
     * @type {number}
     */
    var COMB_MAP_LENGTH = 4;

    /**
     * @TODO replace with transChars.length
     * @private
     * @type {number}
     */
    var TRANS_CHARS_LENGTH = 39;


    /**
     * TODO refactor charsMap for the following structure
     * @private
     * @type {{code: number, mIsolated: number, mInitial: number, mMedial: number, mFinal: number}}
     */
    //var CharRep = {
    //    code: 0,
    //    mIsolated: 0,
    //    mInitial: 0,
    //    mMedial: 0,
    //    mFinal: 0
    //};

    /**
     * TODO refactor combCharsMap for the following structure
     * @private
     * @type {{code: number, mIsolated: number, mInitial: number, mMedial: number, mFinal: number}}
     */
    //var CombCharRep = {
    //    code: 0,
    //    mIsolated: 0,
    //    mInitial: 0,
    //    mMedial: 0,
    //    mFinal: 0
    //};

    /**
     * @private
     * @type {*[]}
     */
    var charsMap = [
        [0x0621, 0xFE80, NIL, NIL, NIL], /* HAMZA */
        [0x0622, 0xFE81, NIL, NIL, 0xFE82], /* ALEF_MADDA */
        [0x0623, 0xFE83, NIL, NIL, 0xFE84], /* ALEF_HAMZA_ABOVE */
        [0x0624, 0xFE85, NIL, NIL, 0xFE86], /* WAW_HAMZA */
        [0x0625, 0xFE87, NIL, NIL, 0xFE88], /* ALEF_HAMZA_BELOW */
        [0x0626, 0xFE89, 0xFE8B, 0xFE8C, 0xFE8A], /* YEH_HAMZA */
        [0x0627, 0xFE8D, NIL, NIL, 0xFE8E], /* ALEF */
        [0x0628, 0xFE8F, 0xFE91, 0xFE92, 0xFE90], /* BEH */
        [0x0629, 0xFE93, NIL, NIL, 0xFE94], /* TEH_MARBUTA */
        [0x062A, 0xFE95, 0xFE97, 0xFE98, 0xFE96], /* TEH */
        [0x062B, 0xFE99, 0xFE9B, 0xFE9C, 0xFE9A], /* THEH */
        [0x062C, 0xFE9D, 0xFE9F, 0xFEA0, 0xFE9E], /* JEEM */
        [0x062D, 0xFEA1, 0xFEA3, 0xFEA4, 0xFEA2], /* HAH */
        [0x062E, 0xFEA5, 0xFEA7, 0xFEA8, 0xFEA6], /* KHAH */
        [0x062F, 0xFEA9, NIL, NIL, 0xFEAA], /* DAL */
        [0x0630, 0xFEAB, NIL, NIL, 0xFEAC], /* THAL */
        [0x0631, 0xFEAD, NIL, NIL, 0xFEAE], /* REH */
        [0x0632, 0xFEAF, NIL, NIL, 0xFEB0], /* ZAIN */
        [0x0633, 0xFEB1, 0xFEB3, 0xFEB4, 0xFEB2], /* SEEN */
        [0x0634, 0xFEB5, 0xFEB7, 0xFEB8, 0xFEB6], /* SHEEN */
        [0x0635, 0xFEB9, 0xFEBB, 0xFEBC, 0xFEBA], /* SAD */
        [0x0636, 0xFEBD, 0xFEBF, 0xFEC0, 0xFEBE], /* DAD */
        [0x0637, 0xFEC1, 0xFEC3, 0xFEC4, 0xFEC2], /* TAH */
        [0x0638, 0xFEC5, 0xFEC7, 0xFEC8, 0xFEC6], /* ZAH */
        [0x0639, 0xFEC9, 0xFECB, 0xFECC, 0xFECA], /* AIN */
        [0x063A, 0xFECD, 0xFECF, 0xFED0, 0xFECE], /* GHAIN */
        [0x0640, 0x0640, NIL, NIL, NIL], /* TATWEEL */
        [0x0641, 0xFED1, 0xFED3, 0xFED4, 0xFED2], /* FEH */
        [0x0642, 0xFED5, 0xFED7, 0xFED8, 0xFED6], /* QAF */
        [0x0643, 0xFED9, 0xFEDB, 0xFEDC, 0xFEDA], /* KAF */
        [0x0644, 0xFEDD, 0xFEDF, 0xFEE0, 0xFEDE], /* LAM */
        [0x0645, 0xFEE1, 0xFEE3, 0xFEE4, 0xFEE2], /* MEEM */
        [0x0646, 0xFEE5, 0xFEE7, 0xFEE8, 0xFEE6], /* NOON */
        [0x0647, 0xFEE9, 0xFEEB, 0xFEEC, 0xFEEA], /* HEH */
        [0x0648, 0xFEED, NIL, NIL, 0xFEEE], /* WAW */
//[ 0x0649, 0xFEEF, 0xFBE8, 0xFBE9, 0xFEF0 ],    /* ALEF_MAKSURA */
        [0x0649, 0xFEEF, NIL, NIL, 0xFEF0], /* ALEF_MAKSURA */
        [0x064A, 0xFEF1, 0xFEF3, 0xFEF4, 0xFEF2] /* YEH */
    ];

    /**
     * @private
     * @type {*[]}
     */
    var combCharsMap = [
        [[0x0644, 0x0622], 0xFEF5, NIL, NIL, 0xFEF6], /* LAM_ALEF_MADDA */
        [[0x0644, 0x0623], 0xFEF7, NIL, NIL, 0xFEF8], /* LAM_ALEF_HAMZA_ABOVE */
        [[0x0644, 0x0625], 0xFEF9, NIL, NIL, 0xFEFA], /* LAM_ALEF_HAMZA_BELOW */
        [[0x0644, 0x0627], 0xFEFB, NIL, NIL, 0xFEFC] /* LAM_ALEF */
    ];

    var transChars = [
        0x0610, /* ARABIC SIGN SALLALLAHOU ALAYHE WASSALLAM */
        0x0612, /* ARABIC SIGN ALAYHE ASSALLAM */
        0x0613, /* ARABIC SIGN RADI ALLAHOU ANHU */
        0x0614, /* ARABIC SIGN TAKHALLUS */
        0x0615, /* ARABIC SMALL HIGH TAH */
        0x064B, /* ARABIC FATHATAN */
        0x064C, /* ARABIC DAMMATAN */
        0x064D, /* ARABIC KASRATAN */
        0x064E, /* ARABIC FATHA */
        0x064F, /* ARABIC DAMMA */
        0x0650, /* ARABIC KASRA */
        0x0651, /* ARABIC SHADDA */
        0x0652, /* ARABIC SUKUN */
        0x0653, /* ARABIC MADDAH ABOVE */
        0x0654, /* ARABIC HAMZA ABOVE */
        0x0655, /* ARABIC HAMZA BELOW */
        0x0656, /* ARABIC SUBSCRIPT ALEF */
        0x0657, /* ARABIC INVERTED DAMMA */
        0x0658, /* ARABIC MARK NOON GHUNNA */
        0x0670, /* ARABIC LETTER SUPERSCRIPT ALEF */
        0x06D6, /* ARABIC SMALL HIGH LIGATURE SAD WITH LAM WITH ALEF MAKSURA */
        0x06D7, /* ARABIC SMALL HIGH LIGATURE QAF WITH LAM WITH ALEF MAKSURA */
        0x06D8, /* ARABIC SMALL HIGH MEEM INITIAL FORM */
        0x06D9, /* ARABIC SMALL HIGH LAM ALEF */
        0x06DA, /* ARABIC SMALL HIGH JEEM */
        0x06DB, /* ARABIC SMALL HIGH THREE DOTS */
        0x06DC, /* ARABIC SMALL HIGH SEEN */
        0x06DF, /* ARABIC SMALL HIGH ROUNDED ZERO */
        0x06E0, /* ARABIC SMALL HIGH UPRIGHT RECTANGULAR ZERO */
        0x06E1, /* ARABIC SMALL HIGH DOTLESS HEAD OF KHAH */
        0x06E2, /* ARABIC SMALL HIGH MEEM ISOLATED FORM */
        0x06E3, /* ARABIC SMALL LOW SEEN */
        0x06E4, /* ARABIC SMALL HIGH MADDA */
        0x06E7, /* ARABIC SMALL HIGH YEH */
        0x06E8, /* ARABIC SMALL HIGH NOON */
        0x06EA, /* ARABIC EMPTY CENTRE LOW STOP */
        0x06EB, /* ARABIC EMPTY CENTRE HIGH STOP */
        0x06EC, /* ARABIC ROUNDED HIGH STOP WITH FILLED CENTRE */
        0x06ED /* ARABIC SMALL LOW MEEM */
    ];


    /**
     * TODO rename into camelCase
     * @private
     *
     * @param code
     * @returns {boolean}
     */
    function characterMapContains(code)
    {
        for (var i = 0; i < MAP_LENGTH; i++)
        {
            //[0] == .code
            if (charsMap[i][0] === code) {
                return true;
            }
        }

        return false;
    }

    /**
     * TODO rename into camelCase
     * @private
     *
     * @param code
     * @returns {CharRep}
     */
    function getCharRep(code)
    {
        for (var i = 0; i < MAP_LENGTH; i++)
        {
            //[0] == .code
            if (charsMap[i][0] === code) {
                return charsMap[i];
            }
        }

        //FIXME CharRep object
        return [ NIL, NIL, NIL, NIL ];
    }


    /**
     * @TODO rename into camelCase
     * @private
     *
     * @param code1
     * @param code2
     * @returns {CombCharRep}
     */
    function  getCombCharRep( code1, code2)
    {
        for (var i = 0; i < COMB_MAP_LENGTH; i++)
        {
            //[0] == .code
            if (combCharsMap[i][0][0] === code1 && combCharsMap[i][0][1] === code2) {
                return combCharsMap[i];
            }
        }

        //FIXME CombCharRep object
        return [[ NIL, NIL ], NIL, NIL, NIL ];
    }

    /**
     * @TODO rename into camelCase
     * @private
     *
     * @param code
     * @returns {boolean}
     */
    function isTransparent(code)
    {
        for (var i = 0; i < TRANS_CHARS_LENGTH; i++)
        {
            if (transChars[i] === code) {
                return true;
            }
        }
        return false;
    }

    /**
     * convert to Arabic Presentation Forms B
     * @param normal
     * @returns {string}
     */
    function convertArabic(normal) {
        if (!normal){
            return '';
        }

        var len = normal.length;
        /* typeof CharRep*/
        var crep;

        /* typeof CombCharRep*/
        var combcrep;

        var shaped = [];

        var writeCount = 0;
        for (var i = 0; i < len; i++) {
            var current = normal.charCodeAt(i);
            if (characterMapContains(current)) {
                var prev = NIL;
                var next = NIL;
                var prevID = i - 1;
                var nextID = i + 1;

                /*
                 Transparent characters have no effect in the shaping process.
                 So, ignore all the transparent characters that are BEFORE the
                 current character.
                 */
                for (; prevID >= 0; prevID--) {
                    if (!isTransparent(normal.charCodeAt(prevID))) {
                        break;
                    }
                }


                //[2] == .mInitial
                //[3] == .mMedial
                if ((prevID < 0) || !characterMapContains(prev = normal.charCodeAt(prevID)) ||
                    (((crep = getCharRep(prev))[2] === NIL) && (crep[3] === NIL))) {
                    prev = NIL;
                }

                /*
                 Transparent characters have no effect in the shaping process.
                 So, ignore all the transparent characters that are AFTER the
                 current character.
                 */
                for (; nextID < len; nextID++) {
                    if (!isTransparent(normal.charCodeAt(nextID))) {
                        break;
                    }
                }

                //[3] == .mMedial
                //[4] == .mFinal
                if ((nextID >= len) || !characterMapContains(next = normal.charCodeAt(nextID)) ||
                    (((crep = getCharRep(next))[3] === NIL) &&
                    ((crep = getCharRep(next))[4] === NIL) && (next !== 0x0640))) {
                    next = NIL;
                }

                /* Combinations */
                if (current === 0x0644 && next !== NIL && (next === 0x0622 || next === 0x0623 ||
                    next === 0x0625 || next === 0x0627)) {
                    combcrep = getCombCharRep(current, next);
                    if (prev !== NIL) {
                        //[4] == .mFinal
                        shaped[writeCount++] = combcrep[4];
                    }
                    else {
                        //[1] == .mIsolated
                        shaped[writeCount++] = combcrep[1];
                    }
                    i++;
                    continue;
                }

                crep = getCharRep(current);

                /* Medial */
                //[3] == .mMedial
                if (prev !== NIL && next !== NIL && crep[3] !== NIL) {
                    shaped[writeCount++] = crep[3];
                    continue;
                    /* Final */
                }
                //[4] == .mFinal
                else if (prev !== NIL && crep[4] !== NIL) {
                    //[4] == .mFinal
                    shaped[writeCount++] = crep[4];
                    continue;
                    /* Initial */
                }

                //[2] == .mInitial
                else if (next !== NIL && crep[2] !== NIL) {
                    shaped[writeCount++] = crep[2];
                    continue;
                }
                /* Isolated */
                //[1] == .mIsolated
                shaped[writeCount++] = crep[1];
            }
            else {
                shaped[writeCount++] = current;
            }
        }
        shaped[writeCount] = NIL;
        var toReturn = '';
        for (var d = 0; d < writeCount; d++) {

            if (typeof shaped[d] !== 'undefined') {
                //toReturn += shaped[d] +' ';
                toReturn += String.fromCharCode(shaped[d]);
            } else {
                console.error('Undefined symbol # ', d);
            }
        }

        return toReturn;
    }


    /**
     * convert from Arabic Presentation Forms B
     * @param apfb
     * @returns {string}
     */
    function convertArabicBack(apfb) {
        if (!apfb) {
            return '';
        }

        var toReturn = "";
        var charCode;
        var selectedChar;
        //console.log("apfb length: ", apfb.length);

        for (var i = 0; i < apfb.length; i++) {
            selectedChar = apfb.charCodeAt(i);
            charCode = null;
            if (selectedChar >= 65136 && selectedChar <= 65279) {
                //console.log("selected char: ", selectedChar);

                for (var j = 0; j < MAP_LENGTH; j++) {
                    //[4] == .mFinal
                    //[2] == .mInitial
                    //[1] == .mIsolated
                    //[3] == .mMedial
                    if (charsMap[j][4] === selectedChar || charsMap[j][2] === selectedChar ||
                        charsMap[j][1] === selectedChar || charsMap[j][3] === selectedChar) {
                        //[0] == .code
                        charCode = charsMap[j][0];
                    }
                }

                //check for combChar
                if (!charCode) {
                    for (var l = 0; l < COMB_MAP_LENGTH; l++) {
                        //[4] == .mFinal
                        //[1] == .mIsolated
                        if (combCharsMap[l][1] === selectedChar || combCharsMap[l][4] === selectedChar) {
                            charCode = selectedChar;
                        }
                    }
                }

                //console.log("final char: ", charCode);
                toReturn += charCode ? String.fromCharCode(charCode) : '';
            } else {
                toReturn += apfb[i];
            }
        }

        return toReturn;
    }

    return {
        convertArabic: convertArabic,
        convertArabicBack: convertArabicBack
    };
}));

