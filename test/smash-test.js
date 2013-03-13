var vows = require("vows"),
    assert = require("assert"),
    fs = require("fs"),
    stream = require("stream"),
    smash = require("../");

var suite = vows.describe("smash");

suite.addBatch({
  "smash": {
    "on a file with no imports": testCase(["test/foo.js"], "test/foo.js"),
    "on a file with imports with trailing comments": testCase(["test/trailing-comment-import.js"], "test/trailing-comment-import-expected.js"),
    "on a file with invalid import syntax": testFailureCase(["test/invalid-import-syntax.js"], "invalid import: test/invalid-import-syntax.js:0: import foo;"),
    "on a file with that imports a file that does not exist": testFailureCase(["test/imports-not-found.js"], "ENOENT, open 'test/not-found.js'"),
    "on a file with a commented-out import": testCase(["test/commented-import.js"], "test/commented-import.js"),
    "on a file with a not-commented-out import": testCase(["test/not-commented-import.js"], "test/not-commented-import-expected.js"),
    "on a file with one import": testCase(["test/imports-foo.js"], "test/imports-foo-expected.js"),
    "on a file with multiple imports": testCase(["test/imports-foo-bar-baz.js"], "test/imports-foo-bar-baz-expected.js"),
    "on a file with nested imports": testCase(["test/imports-imports-foo.js"], "test/imports-imports-foo-expected.js"),
    "on multiple input files": testCase(["test/foo.js", "test/bar.js", "test/baz.js"], "test/imports-foo-bar-baz-expected.js"),
    "with redundant input files": testCase(["test/foo.js", "test/foo.js"], "test/foo.js"),
    "on a file with multiple redundant imports": testCase(["test/imports-foo-foo-bar-foo.js"], "test/imports-foo-foo-bar-foo-expected.js"),
    "when a file imports itself": testCase(["test/imports-self.js"], "test/foo.js"),
    "when circular imports are encountered": testCase(["test/imports-circular-foo.js"], "test/imports-circular-foo-expected.js"),
    "when the input is a directory": testCase(["test/"], "test/index.js"),
    "when the input is missing a file extension": testCase(["test/imports-index"], "test/index.js")
  }
});

suite.export(module);

function testCase(inputs, expected) {
  return {
    topic: function() {
      smash(inputs).pipe(testStream(this.callback));
    },
    "produces the expected output": function(actual) {
      assert.deepEqual(actual, fs.readFileSync(expected, "utf8"));
    }
  };
}

function testFailureCase(inputs, expected) {
  return {
    topic: function() {
      var callback = this.callback;
      smash(inputs).on("error", function(error) {
        callback(null, error);
      });
    },
    "produces the expected error message": function(error) {
      assert.deepEqual(error.message, expected);
    }
  };
}

function testStream(callback) {
  var s = new stream.Writable, chunks = [];

  s._write = function(chunk, encoding, callback) {
    chunks.push(chunk);
    callback();
  };

  s.on("error", callback);
  s.on("finish", function() { callback(null, Buffer.concat(chunks).toString("utf8")); });
  return s;
}
