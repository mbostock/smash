var vows = require("vows"),
    assert = require("assert"),
    smash = require("../");

var suite = vows.describe("smash.readImports");

suite.addBatch({
  "on a file with no imports": {
    topic: function() {
      smash.readImports("test/foo.js", this.callback);
    },
    "returns the empty array": function(imports) {
      assert.deepEqual(imports, []);
    }
  },
  "on a file with imports with trailing comments": {
    topic: function() {
      smash.readImports("test/trailing-comment-import.js", this.callback);
    },
    "returns the empty array": function(imports) {
      assert.deepEqual(imports, ["test/foo.js", "test/bar.js"]);
    }
  },
  "on a file with an invalid import": {
    topic: function() {
      var callback = this.callback;
      smash.readImports("test/invalid-import.js", function(error) {
        callback(null, error);
      });
    },
    "throws an error with the expected message": function(error) {
      assert.deepEqual(error.message, "invalid import: test/invalid-import.js:0: import foo;");
    }
  },
  "on a file with a commented-out import": {
    topic: function() {
      smash.readImports("test/commented-import.js", this.callback);
    },
    "returns the empty array": function(imports) {
      assert.deepEqual(imports, []);
    }
  },
  "on a file with a not commented-out import": {
    topic: function() {
      smash.readImports("test/not-commented-import.js", this.callback);
    },
    "returns the empty array": function(imports) {
      assert.deepEqual(imports, ["test/foo.js"]);
    }
  },
  "on a file with one import": {
    topic: function() {
      smash.readImports("test/imports-foo.js", this.callback);
    },
    "returns the expected import": function(imports) {
      assert.deepEqual(imports, ["test/foo.js"]);
    }
  },
  "on a file with multiple imports": {
    topic: function() {
      smash.readImports("test/imports-foo-bar-baz.js", this.callback);
    },
    "returns the expected imports, in order": function(imports) {
      assert.deepEqual(imports, ["test/foo.js", "test/bar.js", "test/baz.js"]);
    }
  },
  "on a file with multiple redundant imports": {
    topic: function() {
      smash.readImports("test/imports-foo-foo-bar-foo.js", this.callback);
    },
    "returns all imports, in order": function(imports) {
      assert.deepEqual(imports, ["test/foo.js", "test/foo.js", "test/bar.js", "test/foo.js"]);
    }
  },
  "on a file with nested imports": {
    topic: function() {
      smash.readImports("test/imports-imports-foo.js", this.callback);
    },
    "returns the expected imports, in order": function(imports) {
      assert.deepEqual(imports, ["test/imports-foo.js"]);
    }
  }
});

suite.export(module);
