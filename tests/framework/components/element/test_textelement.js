describe("pc.TextElement", function () {
    var app;
    var assets;
    var entity;
    var element;
    var fontAsset;
    var canvas;

    beforeEach(function (done) {
        canvas = document.createElement("canvas");
        app = new pc.Application(canvas);
        buildElement(done);
    });


    afterEach(function () {
        for (var key in assets) {
            assets[key].unload();
        }

        fontAsset = null;
        app.destroy();
        app = null;
        canvas = null;
    });

    var buildElement = function (callback) {
        entity = new pc.Entity("myEntity", app);
        element = app.systems.element.addComponent(entity, { type: pc.ELEMENTTYPE_TEXT });
        element.autoWidth = false;
        element.wrapLines = true;
        element.width = 200;

        fontAsset = new pc.Asset("arial.json", "font", {
            url: "base/examples/assets/fonts/arial.json"
        });

        fontAsset.ready(function () {
            // use timeout to prevent tests running inside ready() callback (so events are cleared on asset)
            setTimeout(function () {
                callback();
            });
        });

        app.assets.add(fontAsset);
        app.assets.load(fontAsset);

        app.root.addChild(entity);

        assets = {
            font: fontAsset
        };
    };

    var assertLineContents = function (expectedLineContents) {
        expect(element.lines.length).to.equal(expectedLineContents.length);
        expect(element.lines).to.deep.equal(expectedLineContents);
    };

    var assertLineColors = function (expectedLineColors) {
        expect(element._text.symbolColors.length).to.equal(expectedLineColors.length);
        expect(element._text.symbolColors).to.deep.equal(expectedLineColors);
    };

    // Creates data for a single translation as if it was a whole asset
    var createTranslation = function (locale, key, translations) {
        var messages = {};
        messages[key] = translations;
        var data = {
            header: {
                version: 1
            },
            data: [{
                info: {
                    locale: locale
                },
                messages: messages
            }]
        };

        return data;
    };

    // Adds the specified key->translations pair for the specified locale to
    // the specified i18n instance, as if it's adding a whole new asset
    var addText = function (locale, key, translations) {
        var data = createTranslation(locale, key, translations);
        app.i18n.addData(data);
        return data;
    };

    var registerRtlHandler = function (lineBreakChar) {
        app.systems.element.registerRtlReorder(function (symbols) {
            var mapping = symbols.map(function (s, i) {
                return i;
            });
            return {
                mapping: mapping,
                isrtl: true
            };
        });
    };

    it("does not break onto multiple lines if the text is short enough", function () {
        element.fontAsset = fontAsset;

        element.text = "abcde fghij";
        assertLineContents(["abcde fghij"]);
    });

    it("does not break onto multiple lines if the autoWidth is set to true", function () {
        element.fontAsset = fontAsset;

        element.autoWidth = true;
        element.text = "abcde fghij klmno pqrst uvwxyz";
        assertLineContents(["abcde fghij klmno pqrst uvwxyz"]);
    });

    it("updates line wrapping once autoWidth becomes false and a width is set", function () {
        element.fontAsset = fontAsset;

        element.autoWidth = true;
        element.text = "abcde fghij klmno pqrst uvwxyz";
        expect(element.lines.length).to.equal(1);
        element.autoWidth = false;
        element.width = 200;
        expect(element.lines.length).to.equal(3);
    });

    it("does not break onto multiple lines if the wrapLines is set to false", function () {
        element.fontAsset = fontAsset;

        element.wrapLines = false;
        element.text = "abcde fghij klmno pqrst uvwxyz";
        assertLineContents(["abcde fghij klmno pqrst uvwxyz"]);
    });

    it("updates line wrapping once wrapLines becomes true", function () {
        element.fontAsset = fontAsset;

        element.wrapLines = false;
        element.text = "abcde fghij klmno pqrst uvwxyz";
        expect(element.lines.length).to.equal(1);
        element.wrapLines = true;
        expect(element.lines.length).to.equal(3);
    });

    it("breaks onto multiple lines if individual lines are too long", function () {
        element.fontAsset = fontAsset;

        element.text = "abcde fghij klmno pqrst uvwxyz";
        assertLineContents([
            "abcde fghij ",
            "klmno pqrst ",
            "uvwxyz"
        ]);
    });

    it("breaks individual words if they are too long to fit onto a line by themselves (single word case)", function () {
        element.fontAsset = fontAsset;

        element.text = "abcdefghijklmnopqrstuvwxyz";
        assertLineContents([
            "abcdefghijklm",
            "nopqrstuvwxy",
            "z"
        ]);
    });

    it("breaks individual words if they are too long to fit onto a line by themselves (multi word case)", function () {
        element.fontAsset = fontAsset;

        element.text = "abcdefgh ijklmnopqrstuvwxyz";
        assertLineContents([
            "abcdefgh ",
            "ijklmnopqrstu",
            "vwxyz"
        ]);
    });

    it("breaks individual characters onto separate lines if the width is really constrained", function () {
        element.fontAsset = fontAsset;

        element.width = 1;
        element.text = "abcdef ghijkl";
        assertLineContents([
            "a",
            "b",
            "c",
            "d",
            "e",
            "f ",
            "g",
            "h",
            "i",
            "j",
            "k",
            "l"
        ]);
    });

    it("does not include whitespace at the end of a line in width calculations", function () {
        element.fontAsset = fontAsset;

        element.text = "abcdefgh        i";
        assertLineContents([
            "abcdefgh        ",
            "i"
        ]);
    });

    it("breaks words on hypens", function () {
        element.fontAsset = fontAsset;

        element.text = "abcde fghij-klm nopqr stuvwxyz";
        assertLineContents([
            "abcde fghij-",
            "klm nopqr ",
            "stuvwxyz"
        ]);
    });

    it("keeps hyphenated word segments together when wrapping them", function () {
        element.fontAsset = fontAsset;

        element.width = 150;
        element.text = "abcde fghij-klm nopqr stuvwxyz";
        assertLineContents([
            "abcde ",
            "fghij-klm ",
            "nopqr ",
            "stuvwxyz"
        ]);
    });

    it("splits lines on \\n", function () {
        element.fontAsset = fontAsset;

        element.text = "abcde\nfghij";
        assertLineContents([
            "abcde",
            "fghij"
        ]);
    });

    it("splits lines on \\r", function () {
        element.fontAsset = fontAsset;

        element.text = "abcde\rfghij";
        assertLineContents([
            "abcde",
            "fghij"
        ]);
    });

    it("splits lines on multiple \\n", function () {
        element.fontAsset = fontAsset;

        element.text = "abcde\n\n\nfg\nhij";
        assertLineContents([
            "abcde",
            "",
            "",
            "fg",
            "hij"
        ]);
    });

    it("does not break beyond 1 line if maxLines is equal to 1", function () {
        element.fontAsset = fontAsset;
        element.maxLines = 1;
        element.text = "abcde fghij klmno pqrst uvwxyz";
        // long contents
        assertLineContents([
            "abcde fghij klmno pqrst uvwxyz"
        ]);
        // multiple new lines
        element.text = "abcde\n\n\nfg\nhij";
        assertLineContents([
            "abcdefghij"
        ]);
        // \r chars
        element.text = "abcde\rfghij";
        assertLineContents([
            "abcdefghij"
        ]);
        // hyphens
        element.text = "abcde fghij-klm nopqr stuvwxyz";
        assertLineContents([
            "abcde fghij-klm nopqr stuvwxyz"
        ]);
        // whitespace at end of line
        element.text = "abcdefgh        i";
        assertLineContents([
            "abcdefgh        i"
        ]);
        // individual characters
        element.width = 1;
        element.text = "abcdef ghijkl";
        assertLineContents([
            "abcdef ghijkl"
        ]);
    });

    it("breaks remaining text in last line when maxLines limit is reached", function () {
        element.fontAsset = fontAsset;
        element.maxLines = 2;
        element.text = "abcde fghij klmno pqrst uvwxyz";
        // long contents
        assertLineContents([
            'abcde fghij ',
            'klmno pqrst uvwxyz'
        ]);
        // multiple new lines
        element.text = "abcde\n\n\nfg\nhij";
        assertLineContents([
            "abcde",
            "fghij"
        ]);
        // \r chars
        element.text = "abcde\rfghij";
        assertLineContents([
            "abcde",
            "fghij"
        ]);
        // hyphens
        element.text = "abcde fghij-klm nopqr stuvwxyz";
        assertLineContents([
            "abcde fghij-",
            "klm nopqr stuvwxyz"
        ]);
        // whitespace at end of line
        element.text = "abcdefgh        i";
        assertLineContents([
            "abcdefgh        ",
            "i"
        ]);
        // individual characters
        element.width = 1;
        element.text = "abcdef ghijkl";
        assertLineContents([
            "a",
            "bcdef ghijkl"
        ]);
    });

    it("rtl - breaks onto multiple lines if individual lines are too long", function () {
        registerRtlHandler();

        element.fontAsset = fontAsset;
        element.rtlReorder = true;

        element.text = "abcde fghij klmno pqrst uvwxyz";
        assertLineContents([
            "abcde fghij ",
            "klmno pqrst ",
            "uvwxyz"
        ]);
    });

    it("rtl - breaks individual words if they are too long to fit onto a line by themselves (single word case)", function () {
        registerRtlHandler();

        element.fontAsset = fontAsset;
        element.rtlReorder = true;

        element.text = "abcdefghijklmnopqrstuvwxyz";
        assertLineContents([
            'abcdefghijklm',
            'nopqrstuvwxy',
            'z'
        ]);
    });

    it("rtl - breaks individual words if they are too long to fit onto a line by themselves (multi word case)", function () {
        registerRtlHandler();
        element.fontAsset = fontAsset;
        element.rtlReorder = true;

        element.text = "abcdefgh ijklmnopqrstuvwxyz";
        assertLineContents([
            'abcdefgh ',
            'ijklmnopqrstu',
            'vwxyz'
        ]);
    });

    it("rtl - breaks individual characters onto separate lines if the width is really constrained", function () {
        registerRtlHandler();
        element.fontAsset = fontAsset;
        element.rtlReorder = true;

        element.width = 1;
        element.text = "abcdef ghijkl";
        assertLineContents([
            "a",
            "b",
            "c",
            "d",
            "e",
            "f ",
            "g",
            "h",
            "i",
            "j",
            "k",
            "l"
        ]);
    });

    it("rtl - does not include whitespace at the end of a line in width calculations", function () {
        registerRtlHandler();
        element.fontAsset = fontAsset;
        element.rtlReorder = true;

        element.text = "abcdefgh        i";
        assertLineContents([
            "abcdefgh        ",
            "i"
        ]);
    });

    it("rtl - breaks words on hypens", function () {
        registerRtlHandler();
        element.fontAsset = fontAsset;
        element.rtlReorder = true;

        element.text = "abcde fghij-klm nopqr stuvwxyz";
        assertLineContents([
            "abcde fghij-",
            "klm nopqr ",
            "stuvwxyz"
        ]);
    });

    it("rtl - keeps hyphenated word segments together when wrapping them", function () {
        registerRtlHandler();
        element.fontAsset = fontAsset;
        element.rtlReorder = true;

        element.width = 150;
        element.text = "abcde fghij-klm nopqr stuvwxyz";
        assertLineContents([
            "abcde ",
            "fghij-klm ",
            "nopqr ",
            "stuvwxyz"
        ]);
    });

    it("rtl - splits lines on \\n", function () {
        registerRtlHandler();
        element.fontAsset = fontAsset;
        element.rtlReorder = true;

        element.text = "abcde\nfghij";
        assertLineContents([
            "abcde",
            "fghij"
        ]);
    });

    it("rtl - splits lines on \\r", function () {
        registerRtlHandler('\r');
        element.fontAsset = fontAsset;
        element.rtlReorder = true;

        element.text = "abcde\rfghij";
        assertLineContents([
            "abcde",
            "fghij"
        ]);
    });

    it("rtl - splits lines on multiple \\n", function () {
        registerRtlHandler();
        element.fontAsset = fontAsset;
        element.rtlReorder = true;

        element.text = "abcde\n\n\nfg\nhij";
        assertLineContents([
            "abcde",
            "",
            "",
            "fg",
            "hij"
        ]);
    });

    it("rtl - does not break beyond 1 line if maxLines is equal to 1", function () {
        registerRtlHandler();
        element.fontAsset = fontAsset;
        element.rtlReorder = true;
        element.maxLines = 1;
        element.text = "abcde fghij klmno pqrst uvwxyz";
        // long contents
        assertLineContents([
            "abcde fghij klmno pqrst uvwxyz"
        ]);
        // multiple new lines
        element.text = "abcde\n\n\nfg\nhij";
        assertLineContents([
            "abcdefghij"
        ]);
        // \r chars
        registerRtlHandler('\r');
        element.text = "abcde\rfghij";
        assertLineContents([
            "abcdefghij"
        ]);

        registerRtlHandler('\n');
        // hyphens
        element.text = "abcde fghij-klm nopqr stuvwxyz";
        assertLineContents([
            "abcde fghij-klm nopqr stuvwxyz"
        ]);
        // whitespace at end of line
        element.text = "abcdefgh        i";
        assertLineContents([
            "abcdefgh        i"
        ]);
        // individual characters
        element.width = 1;
        element.text = "abcdef ghijkl";
        assertLineContents([
            "abcdef ghijkl"
        ]);
    });

    it("rtl breaks remaining text in last line when maxLines limit is reached", function () {
        registerRtlHandler();
        element.fontAsset = fontAsset;
        element.rtlReorder = true;
        element.maxLines = 2;
        element.text = "abcde fghij klmno pqrst uvwxyz";
        // long contents
        assertLineContents([
            "abcde fghij ",
            "klmno pqrst uvwxyz"
        ]);
        // multiple new lines
        element.text = "abcde\n\n\nfg\nhij";
        assertLineContents([
            "abcde",
            "fghij"
        ]);
        // \r chars
        registerRtlHandler('\r');
        element.text = "abcde\rfghij";
        assertLineContents([
            "abcde",
            "fghij"
        ]);
        // hyphens
        registerRtlHandler('\n');
        element.text = "abcde fghij-klm nopqr stuvwxyz";
        assertLineContents([
            "abcde fghij-",
            "klm nopqr stuvwxyz"
        ]);
        // whitespace at end of line
        element.text = "abcdefgh        i";
        assertLineContents([
            "abcdefgh        ",
            "i"
        ]);
        // individual characters
        element.width = 1;
        element.text = "abcdef ghijkl";
        assertLineContents([
            "a",
            "bcdef ghijkl"
        ]);
    });

    it("rtl and ltr text end up with the same width", function () {
        element.fontAsset = fontAsset;
        element.autoWidth = true;
        element.wrapLines = false;

        var ltrWidths = {
            oneLine: 0,
            spaces: 0,
            newLines: 0
        };

        var rtlWidths = Object.assign({}, ltrWidths);

        // new lines
        element.text = 'abcdefghij';
        ltrWidths.oneLine = element.width;

        element.text = 'abcde\nfghij';
        ltrWidths.newLines = element.width;

        element.text = '   abcdefghij   ';
        ltrWidths.spaces = element.width;

        element.text = '';

        registerRtlHandler();
        element.rtlReorder = true;

        element.text = 'abcdefghij';
        rtlWidths.oneLine = element.width;

        element.text = 'abcde\nfghij';
        rtlWidths.newLines = element.width;

        element.text = '   abcdefghij   ';
        rtlWidths.spaces = element.width;

        for (var key in ltrWidths) {
            expect(ltrWidths[key]).to.equal(rtlWidths[key]);
        }
    });

    it("rtl and ltr text in one line using CanvasFont ends up with the same width", function () {
        var cf = new pc.CanvasFont(app, {
            fontName: 'Arial',
            fontSize: 64,
            width: 1024,
            height: 1024
        });

        cf.createTextures('abcdefghij');

        element.font = cf;
        element.autoWidth = true;
        element.wrapLines = false;

        var ltrWidths = {
            oneLine: 0,
            spaces: 0,
            newLines: 0
        };

        var rtlWidths = Object.assign({}, ltrWidths);

        // new lines
        element.text = 'abcdefghij';
        ltrWidths.oneLine = element.width;

        element.text = 'abcde\nfghij';
        ltrWidths.newLines = element.width;

        element.text = '   abcdefghij   ';
        ltrWidths.spaces = element.width;

        element.text = '';

        registerRtlHandler();
        element.rtlReorder = true;

        element.text = 'abcdefghij';
        rtlWidths.oneLine = element.width;

        element.text = 'abcde\nfghij';
        rtlWidths.newLines = element.width;

        element.text = '   abcdefghij   ';
        rtlWidths.spaces = element.width;

        for (var key in ltrWidths) {
            expect(ltrWidths[key]).to.equal(rtlWidths[key]);
        }
    });

    it("reduces font size when width is larger then the element width and autoFitWidth is true", function () {
        element.fontAsset = fontAsset;
        element.autoWidth = false;
        element.autoHeight = false;
        element.width = 10;
        element.text = "ab";

        var width = element.calculatedWidth;
        var textWidth = element._text.width;
        element.autoFitWidth = true;
        expect(element.fontSize).to.equal(Math.floor(32 * width / textWidth));
        expect(element._text._scaledLineHeight).to.equal(32 * element.fontSize / element.maxFontSize);
    });

    it("does not reduce font size when width is larger then the element width and autoFitWidth is false", function () {
        element.fontAsset = fontAsset;
        element.autoWidth = false;
        element.autoHeight = false;
        element.fontSize = 20;
        element.lineHeight = 20;
        element.width = 10;
        element.text = "ab";
        expect(element.fontSize).to.equal(20);
        expect(element._text._scaledLineHeight).to.equal(20);
    });

    it("does not reduce font size when autoFitWidth and autoWidth are both true", function () {
        element.fontAsset = fontAsset;
        element.autoWidth = true;
        element.autoHeight = false;
        element.width = 10;
        element.text = "ab";
        expect(element.fontSize).to.equal(32);
    });

    it("does not reduce the font size below minFontSize", function () {
        element.fontAsset = fontAsset;
        element.autoWidth = false;
        element.autoHeight = false;
        element.width = 1;
        element.text = "ab";
        element.autoFitWidth = true;
        expect(element.fontSize).to.equal(element.minFontSize);
    });

    it("updates fontSize to new minFontSize", function () {
        element.fontAsset = fontAsset;
        element.autoWidth = false;
        element.autoHeight = false;
        element.width = 1;
        element.text = "abcdefghijklmn";
        element.minFontSize = 8;
        element.autoFitWidth = true;
        expect(element.fontSize).to.equal(8);
        element.minFontSize = 4;
        expect(element.fontSize).to.equal(4);
    });

    it("does not increase the font size above maxFontSize", function () {
        element.fontAsset = fontAsset;
        element.autoWidth = false;
        element.autoHeight = false;
        element.maxFontSize = 10;
        element.width = 1000;
        element.text = "ab";
        element.autoFitWidth = true;
        expect(element.fontSize).to.equal(element.maxFontSize);
    });

    it("updates fontSize to new maxFontSize", function () {
        element.fontAsset = fontAsset;
        element.autoWidth = false;
        element.autoHeight = false;
        element.maxFontSize = 10;
        element.width = 1000;
        element.text = "abcdefghijklmn";
        element.autoFitWidth = true;
        expect(element.fontSize).to.equal(10);
        element.maxFontSize = 11;
        expect(element.fontSize).to.equal(11);
    });

    it("reduces font size when height is larger then the element height and autoFitHeight is true", function () {
        element.fontAsset = fontAsset;
        element.autoWidth = false;
        element.autoHeight = false;
        element.height = 50;
        element.text = "ab\nab";
        element.autoFitHeight = true;
        expect(element.fontSize).to.equal(25);
        expect(element._text._scaledLineHeight).to.equal(25);
    });

    it("does not reduce font size when height is larger then the element height and autoFitHeight is false", function () {
        element.fontAsset = fontAsset;
        element.autoWidth = false;
        element.autoHeight = false;
        element.fontSize = 20;
        element.lineHeight = 20;
        element.height = 50;
        element.text = "ab\nab";
        expect(element.fontSize).to.equal(20);
        expect(element._text._scaledLineHeight).to.equal(20);
    });

    it("does not reduce font size when autoFitHeight and autoHeight are both true", function () {
        element.fontAsset = fontAsset;
        element.autoWidth = false;
        element.autoHeight = true;
        element.autoFitHeight = true;
        element.height = 50;
        element.text = "ab\nab";
        expect(element.fontSize).to.equal(32);
    });

    it("does not reduce font size below minFontSize when height is larger then the element height", function () {
        element.fontAsset = fontAsset;
        element.autoWidth = false;
        element.autoHeight = false;
        element.height = 1;
        element.minFontSize = 8;
        element.text = "ab\nab";
        element.autoFitHeight = true;
        expect(element.fontSize).to.equal(element.minFontSize);
    });

    it("does not increase font size above maxFontSize when height is smaller then the element height", function () {
        element.fontAsset = fontAsset;
        element.autoWidth = false;
        element.autoHeight = false;
        element.height = 1000;
        element.maxFontSize = 8;
        element.text = "ab\nab";
        element.autoFitHeight = true;
        expect(element.fontSize).to.equal(element.maxFontSize);
    });

    it('restores fontSize after setting autoFitWidth to false', function () {
        element.fontSize = 44;
        element.fontAsset = fontAsset;
        element.autoWidth = false;
        element.autoHeight = false;
        element.width = 10;
        element.text = "ab";
        element.autoFitWidth = true;
        expect(element.fontSize).to.not.equal(44);
        element.autoFitWidth = false;
        expect(element.fontSize).to.equal(44);
    });

    it('does not change fontSize after setting autoFitWidth to true while autoWidth is already true', function () {
        element.fontSize = 44;
        element.fontAsset = fontAsset;
        element.autoWidth = true;
        element.autoHeight = false;
        element.text = "ab";
        expect(element.fontSize).to.equal(44);
        element.autoFitWidth = true;
        expect(element.fontSize).to.equal(44);
    });

    it('restores fontSize to maxFontSize after setting autoFitWidth to false if autoFitHeight is true', function () {
        element.fontSize = 44;
        element.fontAsset = fontAsset;
        element.autoWidth = false;
        element.autoHeight = false;
        element.width = 10;
        element.height = 1000;
        element.text = "ab";
        element.autoFitWidth = true;
        element.autoFitHeight = true;
        expect(element.fontSize).to.not.equal(44);
        element.autoFitWidth = false;
        expect(element.fontSize).to.equal(element.maxFontSize);
    });

    it('restores fontSize after setting autoFitHeight to false', function () {
        element.fontSize = 44;
        element.fontAsset = fontAsset;
        element.autoWidth = false;
        element.autoHeight = false;
        element.height = 50;
        element.text = "ab\nab";
        element.autoFitHeight = true;
        expect(element.fontSize).to.not.equal(44);
        element.autoFitHeight = false;
        expect(element.fontSize).to.equal(44);
    });

    it('does not change fontSize after setting autoFitHeight to true while autoHeight is already true', function () {
        element.fontSize = 44;
        element.fontAsset = fontAsset;
        element.autoWidth = false;
        element.autoHeight = true;
        element.text = "ab\nab";
        expect(element.fontSize).to.equal(44);
        element.autoFitHeight = true;
        expect(element.fontSize).to.equal(44);
    });

    it('restores fontSize to maxFontSize after setting autoFitHeight to false if autoFitWidth is true', function () {
        element.fontSize = 44;
        element.fontAsset = fontAsset;
        element.autoWidth = false;
        element.autoHeight = false;
        element.height = 50;
        element.text = "ab\nab";
        element.autoFitHeight = true;
        element.autoFitWidth = true;
        expect(element.fontSize).to.not.equal(44);
        element.autoFitHeight = false;
        expect(element.fontSize).to.equal(element.maxFontSize);
    });

    it('restores fontSize if autoFitWidth is true and autoWidth becomes true', function () {
        element.fontSize = 44;
        element.fontAsset = fontAsset;
        element.autoWidth = false;
        element.autoHeight = false;
        element.width = 10;
        element.text = "ab";
        element.autoFitWidth = true;
        expect(element.fontSize).to.not.equal(44);
        element.autoWidth = true;
        expect(element.fontSize).to.equal(44);
    });

    it('restores fontSize if autoFitHeight is true and autoHeight becomes true', function () {
        element.fontSize = 44;
        element.fontAsset = fontAsset;
        element.autoWidth = false;
        element.autoHeight = false;
        element.height = 50;
        element.text = "ab\nab";
        element.autoFitHeight = true;
        expect(element.fontSize).to.not.equal(44);
        element.autoHeight = true;
        expect(element.fontSize).to.equal(44);
    });

    it('restores fontSize to maxFontSize when autoHeight becomes true while autoFitHeight and autoFitWidth are true', function () {
        element.fontSize = 44;
        element.fontAsset = fontAsset;
        element.autoWidth = false;
        element.autoHeight = false;
        element.height = 50;
        element.width = 1000;
        element.text = "ab\nab";
        element.autoFitWidth = true;
        element.autoFitHeight = true;
        expect(element.fontSize).to.not.equal(44);
        element.autoHeight = true;
        expect(element.fontSize).to.equal(element.maxFontSize);
    });

    it('restores fontSize to maxFontSize when autoWidth becomes true while autoFitHeight and autoFitWidth are true', function () {
        element.fontSize = 44;
        element.fontAsset = fontAsset;
        element.autoWidth = false;
        element.autoHeight = false;
        element.height = 1000;
        element.text = "ab";
        element.autoFitWidth = true;
        element.autoFitHeight = true;
        expect(element.fontSize).to.not.equal(44);
        element.autoWidth = true;
        expect(element.fontSize).to.equal(element.maxFontSize);
    });

    it('AssetRegistry events unbound on destroy for font asset', function () {
        var e = new pc.Entity();

        e.addComponent('element', {
            type: 'text',
            fontAsset: 123456
        });

        expect(app.assets.hasEvent('add:123456')).to.be.true;

        e.destroy();

        expect(app.assets.hasEvent('add:123456')).to.be.false;
    });


    it('Font assets unbound when reset', function () {
        expect(assets.font.hasEvent('add')).to.be.false;
        expect(assets.font.hasEvent('change')).to.be.false;
        expect(assets.font.hasEvent('load')).to.be.false;
        expect(assets.font.hasEvent('remove')).to.be.false;

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'text',
            fontAsset: assets.font
        });

        e.element.fontAsset = null;

        expect(assets.font.hasEvent('add')).to.be.false;
        expect(assets.font.hasEvent('change')).to.be.false;
        expect(assets.font.hasEvent('load')).to.be.false;
        expect(assets.font.hasEvent('remove')).to.be.false;
    });

    it('Font assets unbound when destroy', function () {
        expect(assets.font.hasEvent('add')).to.be.false;
        expect(assets.font.hasEvent('change')).to.be.false;
        expect(assets.font.hasEvent('load')).to.be.false;
        expect(assets.font.hasEvent('remove')).to.be.false;

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'text',
            fontAsset: assets.font
        });

        e.destroy();

        expect(assets.font.hasEvent('add')).to.be.false;
        expect(assets.font.hasEvent('change')).to.be.false;
        expect(assets.font.hasEvent('load')).to.be.false;
        expect(assets.font.hasEvent('remove')).to.be.false;
    });

    it('Font assets to be bound once when enabled late', function () {
        expect(assets.font.hasEvent('add')).to.be.false;
        expect(assets.font.hasEvent('change')).to.be.false;
        expect(assets.font.hasEvent('load')).to.be.false;
        expect(assets.font.hasEvent('remove')).to.be.false;

        var e = new pc.Entity();
        e.enabled = false;
        e.addComponent('element', {
            type: 'text',
            fontAsset: assets.font
        });
        app.root.addChild(e);

        e.enabled = true;

        e.element.fontAsset = null;

        expect(assets.font.hasEvent('add')).to.be.false;
        expect(assets.font.hasEvent('change')).to.be.false;
        expect(assets.font.hasEvent('load')).to.be.false;
        expect(assets.font.hasEvent('remove')).to.be.false;
    });

    it('CanvasFont render event is unbound when reset', function () {
        var cf = new pc.CanvasFont(app, {
            fontName: 'Arial'
        });

        cf.createTextures('abc');

        expect(cf.hasEvent('render')).to.be.false;

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'text',
            text: 'abc'
        });
        app.root.addChild(e);

        e.element.font = cf;

        expect(cf.hasEvent('render')).to.be.true;

        e.element.font = null;

        expect(cf.hasEvent('render')).to.be.false;
    });

    it('CanvasFont render event is unbound on destroy', function () {
        var cf = new pc.CanvasFont(app, {
            fontName: 'Arial'
        });

        cf.createTextures('abc');

        expect(cf.hasEvent('render')).to.be.false;

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'text',
            text: 'abc'
        });
        app.root.addChild(e);

        e.element.font = cf;

        expect(cf.hasEvent('render')).to.be.true;

        e.destroy();

        expect(cf.hasEvent('render')).to.be.false;
    });

    it("defaults to white color and opacity 1", function () {
        expect(element.color.r).to.equal(1);
        expect(element.color.g).to.equal(1);
        expect(element.color.b).to.equal(1);
        expect(element.opacity).to.equal(1);

        var meshes = element._text._model.meshInstances;
        for (var i = 0; i < meshes.length; i++) {
            var color = meshes[i].getParameter('material_emissive').data;
            expect(color[0]).to.equal(1);
            expect(color[1]).to.equal(1);
            expect(color[2]).to.equal(1);

            var opacity = meshes[i].getParameter('material_opacity').data;
            expect(opacity).to.equal(1);
        }
    });

    it("uses color and opacity passed in addComponent data", function () {
        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'text',
            text: 'test',
            fontAsset: element.fontAsset,
            color: [0.1, 0.2, 0.3],
            opacity: 0.4
        });

        expect(e.element.color.r).to.be.closeTo(0.1, 0.001);
        expect(e.element.color.g).to.be.closeTo(0.2, 0.001);
        expect(e.element.color.b).to.be.closeTo(0.3, 0.001);
        expect(e.element.opacity).to.be.closeTo(0.4, 0.001);

        var meshes = e.element._text._model.meshInstances;
        for (var i = 0; i < meshes.length; i++) {
            var color = meshes[i].getParameter('material_emissive').data;
            expect(color[0]).to.be.closeTo(0.1, 0.001);
            expect(color[1]).to.be.closeTo(0.2, 0.001);
            expect(color[2]).to.be.closeTo(0.3, 0.001);

            var opacity = meshes[i].getParameter('material_opacity').data;
            expect(opacity).to.be.closeTo(0.4, 0.001);
        }
    });

    it("changes color", function () {
        element.color = new pc.Color(0.1, 0.2, 0.3);

        expect(element.color.r).to.be.closeTo(0.1, 0.001);
        expect(element.color.g).to.be.closeTo(0.2, 0.001);
        expect(element.color.b).to.be.closeTo(0.3, 0.001);
        expect(element.opacity).to.be.closeTo(1, 0.001);

        var meshes = element._text._model.meshInstances;
        for (var i = 0; i < meshes.length; i++) {
            var color = meshes[i].getParameter('material_emissive').data;
            expect(color[0]).to.be.closeTo(0.1, 0.001);
            expect(color[1]).to.be.closeTo(0.2, 0.001);
            expect(color[2]).to.be.closeTo(0.3, 0.001);

            var opacity = meshes[i].getParameter('material_opacity').data;
            expect(opacity).to.be.closeTo(1, 0.001);
        }
    });

    it("changes opacity", function () {
        element.opacity = 0.4;
        expect(element.opacity).to.be.closeTo(0.4, 0.001);

        var meshes = element._text._model.meshInstances;
        for (var i = 0; i < meshes.length; i++) {
            var opacity = meshes[i].getParameter('material_opacity').data;
            expect(opacity).to.be.closeTo(0.4, 0.001);
        }
    });


    it("cloned text component is complete", function () {
        var e = new pc.Entity();

        e.addComponent('element', {
            type: 'text',
            text: 'test',
            fontAsset: assets.font
        });

        var clone = e.clone();

        expect(e.element.fontAsset).to.be.ok;

        expect(clone.element.text).to.equal(e.element.text);
        expect(clone.element.fontAsset).to.equal(e.element.fontAsset);
        expect(clone.element.font).to.equal(e.element.font);
        expect(clone.element.color).to.deep.equal(e.element.color);
        expect(clone.element.spacing).to.equal(e.element.spacing);
        expect(clone.element.fontSize).to.equal(e.element.fontSize);
        expect(clone.element.lineHeight).to.equal(e.element.lineHeight);
        expect(clone.element.alignment).to.deep.equal(e.element.alignment);
        expect(clone.element.wrapLines).to.equal(e.element.wrapLines);
        expect(clone.element.autoWidth).to.equal(e.element.autoWidth);
        expect(clone.element.autoHeight).to.equal(e.element.autoHeight);
    });

    it("clears font asset when font is assigned directly", function () {
        var e = new pc.Entity();

        e.addComponent('element', {
            type: 'text',
            text: '',
            fontAsset: assets.font
        });

        var font = new pc.CanvasFont(app);
        font.createTextures(' ');

        e.element.font = font;

        expect(e.element.font).to.equal(font);
        expect(e.element.fontAsset).to.equal(null);
    });


    it('Offscreen element is culled', function () {
        var canvasWidth = app.graphicsDevice.width;
        var canvasHeight = app.graphicsDevice.height;

        var screen = new pc.Entity();
        screen.addComponent('screen', {
            screenSpace: true
        });
        app.root.addChild(screen);

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'text',
            text: "test",
            fontAsset: fontAsset,
            autoWidth: false,
            autoHeight: false,
            width: 100,
            height: 100,
            pivot: [0.5,0.5]
        });
        screen.addChild(e);

        var camera = new pc.Entity();
        camera.addComponent('camera');
        app.root.addChild(camera);

        // update transform
        app.update(0.1);
        app.render();

        var meshInstance = e.element._text._model.meshInstances[0];

        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.true;

        // move just off screen
        e.translateLocal(canvasWidth+(100/2)+0.001,0,0);

        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.false;

        // move just on screen
        e.translateLocal(-1, 0, 0);

        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.true;

    });

    it('Offscreen autowidth element is culled', function () {
        var canvasWidth = app.graphicsDevice.width;
        var canvasHeight = app.graphicsDevice.height;

        var screen = new pc.Entity();
        screen.addComponent('screen', {
            screenSpace: true
        });
        app.root.addChild(screen);

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'text',
            text: "test",
            fontAsset: fontAsset,
            autoWidth: true,
            autoHeight: false,
            width: 100,
            height: 100,
            pivot: [0.5,0.5]
        });
        screen.addChild(e);

        var camera = new pc.Entity();
        camera.addComponent('camera');
        app.root.addChild(camera);

        // update transform
        app.update(0.1);
        app.render();

        var meshInstance = e.element._text._model.meshInstances[0];

        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.true;

        // move just off screen
        e.translateLocal(canvasWidth+(e.element.width/2)+0.001,0,0);

        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.false;

        // move just on screen
        e.translateLocal(-1, 0, 0);

        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.true;
    });

    it('Offscreen child element is culled', function () {
        var canvasWidth = app.graphicsDevice.width;
        var canvasHeight = app.graphicsDevice.height;

        var screen = new pc.Entity();
        screen.addComponent('screen', {
            screenSpace: true
        });
        app.root.addChild(screen);

        var parent = new pc.Entity();
        parent.addComponent('element', {
            type: 'text',
            text: "test",
            fontAsset: fontAsset,
            autoWidth: false,
            autoHeight: false,
            width: 100,
            height: 100,
            pivot: [0.5,0.5]
        });
        screen.addChild(parent);

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'text',
            text: "test",
            fontAsset: fontAsset,
            autoWidth: false,
            autoHeight: false,
            width: 100,
            height: 100,
            pivot: [0.5,0.5]
        });
        parent.addChild(e);

        var camera = new pc.Entity();
        camera.addComponent('camera');
        app.root.addChild(camera);

        var meshInstance = e.element._text._model.meshInstances[0];

        // update transform
        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.true;

        // move just off screen
        parent.translateLocal(50, 50, 0);
        e.translateLocal(351, 50, 0);

        // update transform
        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.false;
    });


    it('Offscreen rotated element is culled', function () {
        var canvasWidth = app.graphicsDevice.width;
        var canvasHeight = app.graphicsDevice.height;

        var screen = new pc.Entity();
        screen.addComponent('screen', {
            screenSpace: true
        });
        app.root.addChild(screen);

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'text',
            text: "test",
            fontAsset: fontAsset,
            autoWidth: false,
            autoHeight: false,
            width: 100,
            height: 100,
            pivot: [0.5,0.5]
        });
        screen.addChild(e);

        var camera = new pc.Entity();
        camera.addComponent('camera');
        app.root.addChild(camera);

        // move just off screen (when rotated 45°)
        e.translateLocal(300 + (50*Math.sqrt(2)), 0, 0);
        e.rotateLocal(0, 0, 45);

        var meshInstance = e.element._text._model.meshInstances[0];

        // update transform
        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.false;
    });

    it('Offscreen rotated out of plane is culled', function () {
        var canvasWidth = app.graphicsDevice.width;
        var canvasHeight = app.graphicsDevice.height;

        var screen = new pc.Entity();
        screen.addComponent('screen', {
            screenSpace: true
        });
        app.root.addChild(screen);

        var e = new pc.Entity();
        e.addComponent('element', {
            type: 'text',
            text: "test",
            fontAsset: fontAsset,
            autoWidth: false,
            autoHeight: false,
            width: 100,
            height: 100,
            pivot: [0.5,0.5]
        });
        screen.addChild(e);

        var camera = new pc.Entity();
        camera.addComponent('camera');
        app.root.addChild(camera);

        // move just off screen (when rotated 45°)
        e.translateLocal(300, 0, 0);
        e.rotateLocal(0, 90, 0);

        var meshInstance = e.element._text._model.meshInstances[0];

        // update transform
        app.update(0.1);
        app.render();
        expect(e.element.isVisibleForCamera(camera.camera.camera)).to.be.false;
    });

    it('text is set to translated text when we set the key', function () {
        addText('en-US', 'key', 'translation');
        element.fontAsset = fontAsset;
        element.key = "key";
        assertLineContents(["translation"]);
    });

    it('text is not translated when we set the text property', function () {
        addText('en-US', 'key', 'translation');
        element.fontAsset = fontAsset;
        element.text = "key";
        assertLineContents(["key"]);
        expect(element.key).to.equal(null);
    });

    it('text changes language when we change the locale', function () {
        addText('en-US', 'key', 'translation');
        addText('fr-FR', 'key', 'french');
        element.fontAsset = fontAsset;
        element.key = "key";
        assertLineContents(["translation"]);
        app.i18n.locale = 'fr-FR';
        assertLineContents(["french"]);
    });

    it('text changes language when we add translations for the current locale', function () {
        element.fontAsset = fontAsset;
        element.key = "key";
        assertLineContents(["key"]);
        addText('en-US', 'key', 'translation');
        assertLineContents(["translation"]);
    });

    it('text changes to first plural entry when the key is plural', function () {
        element.fontAsset = fontAsset;
        element.key = "key";
        assertLineContents(["key"]);
        addText('en-US', 'key', ['one', 'other']);
        assertLineContents(["one"]);
    });

    it('cloning text element clones the localization key', function () {
        addText('en-US', 'key', 'translation');
        element.fontAsset = fontAsset;
        element.key = 'key';

        var clone = element.entity.clone();
        expect(clone.element.key).to.equal('key');
        expect(clone.element.text).to.equal('translation');
    });

    it('cloning text element with no localization key clones text correctly', function () {
        addText('en-US', 'key', 'translation');
        element.fontAsset = fontAsset;
        element.text = 'text';

        var clone = element.entity.clone();
        expect(clone.element.key).to.equal(null);
        expect(clone.element.text).to.equal('text');
    });

    it('text does not wrap when its width reaches exactly the width of the element', function () {
        element.fontAsset = fontAsset;
        element.wrapLines = true;
        element.autoWidth = true;
        element.text = 'abcd';
        assertLineContents(['abcd']);

        element.autoWidth = false;
        element.text = '';
        element.text = 'abcd';
        // should not wrap
        assertLineContents(['abcd']);

        element.text = 'abcde';
        // now it should wrap
        assertLineContents(['abcd', 'e']);
    });

    it('changing the locale changes the font asset', function (done) {
        assets.font2 = new pc.Asset("courier.json", "font", {
            url: "base/examples/assets/fonts/courier.json"
        });

        app.assets.add(assets.font2);

        assets.font2.on('load', function () {
            setTimeout(function () {
                expect(element.fontAsset).to.equal(assets.font2.id);
                expect(element.font).to.equal(assets.font2.resource);
                done();
            });
        });

        fontAsset.addLocalizedAssetId('fr', assets.font2.id);

        addText('en-US', 'key', 'translation');
        addText('fr', 'key', 'french translation');
        element.fontAsset = fontAsset;
        element.key = "key";

        app.i18n.locale = 'fr';
    });

    it('text element that does not use localization uses the default font asset not its localized variant', function (done) {
        assets.font2 = new pc.Asset("courier.json", "font", {
            url: "base/examples/assets/fonts/courier.json"
        });

        app.assets.add(assets.font2);
        app.assets.load(assets.font2);

        assets.font2.on('load', function () {
            app.i18n.locale = 'fr';
            setTimeout(function () {
                expect(element.font).to.equal(assets.font.resource);
                expect(element.fontAsset).to.equal(assets.font.id);
                done();
            });
        });

        fontAsset.addLocalizedAssetId('fr', assets.font2.id);
        element.fontAsset = fontAsset;
        element.text = 'text';
    });

    it('if text element is disabled it does not automatically load localizedAssets', function () {
        assets.font2 = new pc.Asset("courier.json", "font", {
            url: "base/examples/assets/fonts/courier.json"
        });

        app.assets.add(assets.font2);

        fontAsset.addLocalizedAssetId('fr', assets.font2.id);

        addText('en-US', 'key', 'translation');
        addText('fr', 'key', 'french translation');
        element.fontAsset = fontAsset;
        element.key = "key";

        entity.element.enabled = false;

        app.i18n.locale = 'fr';

        expect(assets.font2.hasEvent('load')).to.equal(false);
    });

    it('text element removes i18n event listeners on destroy', function () {
        expect(app.i18n.hasEvent('set:locale')).to.equal(true);
        expect(app.i18n.hasEvent('data:add')).to.equal(true);
        expect(app.i18n.hasEvent('data:remove')).to.equal(true);

        element.entity.destroy();

        expect(app.i18n.hasEvent('set:locale')).to.equal(false);
        expect(app.i18n.hasEvent('data:add')).to.equal(false);
        expect(app.i18n.hasEvent('data:remove')).to.equal(false);
    });

    it('text markup color tag', function () {
        registerRtlHandler('\r');
        element.fontAsset = fontAsset;
        element.rtlReorder = true;
        element.enableMarkup = true;
        element.autoWidth = true;

        element.text = "text element [color=\"#ff0000\"]in red[/color] or not";

        assertLineContents([
            "text element in red or not"
        ]);

        var w = [255, 255, 255];
        var r = [255, 0, 0];
        assertLineColors([
            w, w, w, w, w, w, w, w, w, w, w, w, w, r, r, r, r, r, r, w, w, w, w, w, w, w
        ]);
    });

    it('text markup color without closing tag', function () {
        element.fontAsset = fontAsset;
        element.enableMarkup = true;
        element.autoWidth = true;

        element.text = "text element [color=\"#ff0000\"]in red or not";
        assertLineContents([
            "text element [color=\"#ff0000\"]in red or not"
        ]);

        expect(element._text.symbolColors).to.equal(null);
    });

    it('text markup with escaping open bracket', function () {
        element.fontAsset = fontAsset;
        element.enableMarkup = true;
        element.autoWidth = true;

        element.text = "text element \\[color=\"#ff0000\"]in red or not";
        assertLineContents([
            "text element [color=\"#ff0000\"]in red or not"
        ]);

        expect(element._text.symbolColors).to.equal(null);
    });

    it('text markup with attributes', function () {
        element.fontAsset = fontAsset;
        element.enableMarkup = true;
        element.autoWidth = true;

        element.text = "abcd efgh [tag attr1=\"1\" attr2=\"2\"]ijkl[/tag] mnop";
        assertLineContents([
            "abcd efgh ijkl mnop"
        ]);

        var w = [255, 255, 255];
        assertLineColors([
            w, w, w, w, w, w, w, w, w, w, w, w, w, w, w, w, w, w, w
        ]);
    });
});
