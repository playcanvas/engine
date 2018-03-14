module("pc.TextElement", {
    setup: function () {
        this.app = new pc.Application(document.createElement("canvas"));

        stop();

        this.buildElement(start);
    },

    buildElement: function(callback) {
        var entity = new pc.Entity("myEntity", this.app);
        var element = this.app.systems.element.addComponent(entity, { type: pc.ELEMENTTYPE_TEXT });
        element.autoWidth = false;
        element.wrapLines = true;
        element.width = 200;

        var fontAsset = new pc.Asset("Arial", "font", {
            url: "../../../../examples/assets/Arial/Arial.json"
        });

        fontAsset.ready(function() {
            element.fontAsset = fontAsset;
            callback(element);
        }.bind(this));

        this.app.assets.add(fontAsset);
        this.app.assets.load(fontAsset);

        this.entity = entity;
        this.element = element;
        this.app.root.addChild(entity);
    },

    assertLineContents: function(expectedLineContents) {
        deepEqual(this.element.lines.length, expectedLineContents.length);
        deepEqual(this.element.lines, expectedLineContents);
    },

    teardown: function () {
        this.app.destroy();
    }
});

test("does not break onto multiple lines if the text is short enough", function () {
    this.element.text = "abcde fghij";
    this.assertLineContents(["abcde fghij"]);
});

test("does not break onto multiple lines if the autoWidth is set to true", function () {
    this.element.autoWidth = true;
    this.element.text = "abcde fghij klmno pqrst uvwxyz";
    this.assertLineContents(["abcde fghij klmno pqrst uvwxyz"]);
});

test("updates line wrapping once autoWidth becomes false and a width is set", function () {
    this.element.autoWidth = true;
    this.element.text = "abcde fghij klmno pqrst uvwxyz";
    equal(this.element.lines.length, 1);
    this.element.autoWidth = false;
    this.element.width = 200;
    equal(this.element.lines.length, 3);
});

test("does not break onto multiple lines if the wrapLines is set to false", function () {
    this.element.wrapLines = false;
    this.element.text = "abcde fghij klmno pqrst uvwxyz";
    this.assertLineContents(["abcde fghij klmno pqrst uvwxyz"]);
});

test("updates line wrapping once wrapLines becomes true", function () {
    this.element.wrapLines = false;
    this.element.text = "abcde fghij klmno pqrst uvwxyz";
    equal(this.element.lines.length, 1);
    this.element.wrapLines = true;
    equal(this.element.lines.length, 3);
});

test("breaks onto multiple lines if individual lines are too long", function () {
    this.element.text = "abcde fghij klmno pqrst uvwxyz";
    this.assertLineContents([
        "abcde fghij ",
        "klmno pqrst ",
        "uvwxyz"
    ]);
});

test("breaks individual words if they are too long to fit onto a line by themselves (single word case)", function () {
    this.element.text = "abcdefghijklmnopqrstuvwxyz";
    this.assertLineContents([
        "abcdefghijklm",
        "nopqrstuvwxy",
        "z"
    ]);
});

test("breaks individual words if they are too long to fit onto a line by themselves (multi word case)", function () {
    this.element.text = "abcdefgh ijklmnopqrstuvwxyz";
    this.assertLineContents([
        "abcdefgh ",
        "ijklmnopqrstu",
        "vwxyz"
    ]);
});

test("breaks individual characters onto separate lines if the width is really constrained", function () {
    this.element.width = 1;
    this.element.text = "abcdef ghijkl";
    this.assertLineContents([
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
        "l",
    ]);
});

test("does not include whitespace at the end of a line in width calculations", function () {
    this.element.text = "abcdefgh        i";
    this.assertLineContents([
        "abcdefgh        ",
        "i"
    ]);
});

test("breaks words on hypens", function () {
    this.element.text = "abcde fghij-klm nopqr stuvwxyz";
    this.assertLineContents([
        "abcde fghij-",
        "klm nopqr ",
        "stuvwxyz"
    ]);
});

test("keeps hyphenated word segments together when wrapping them", function () {
    this.element.width = 150;
    this.element.text = "abcde fghij-klm nopqr stuvwxyz";
    this.assertLineContents([
        "abcde ",
        "fghij-klm ",
        "nopqr ",
        "stuvwxyz"
    ]);
});

test("splits lines on \\n", function () {
    this.element.text = "abcde\nfghij";
    this.assertLineContents([
        "abcde",
        "fghij"
    ]);
});

test("splits lines on \\r", function () {
    this.element.text = "abcde\rfghij";
    this.assertLineContents([
        "abcde",
        "fghij"
    ]);
});

test("splits lines on multiple \\n", function () {
    this.element.text = "abcde\n\n\nfg\nhij";
    this.assertLineContents([
        "abcde",
        "",
        "",
        "fg",
        "hij"
    ]);
});
