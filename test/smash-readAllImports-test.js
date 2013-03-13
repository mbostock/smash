var vows = require("vows"),
    assert = require("assert"),
    smash = require("../");

var suite = vows.describe("smash.readAllImports");

suite.addBatch({
  "readAllImports": {
    "on a file with no imports": {
      topic: function() {
        smash.readAllImports(["test/foo.js"], this.callback);
      },
      "returns only the input file": function(imports) {
        assert.deepEqual(imports, ["test/foo.js"]);
      }
    },
    "on a file with imports with trailing comments": {
      topic: function() {
        smash.readAllImports(["test/trailing-comment-import.js"], this.callback);
      },
      "returns the empty array": function(imports) {
        assert.deepEqual(imports, ["test/foo.js", "test/bar.js", "test/trailing-comment-import.js"]);
      }
    },
    "on a file with invalid import syntax": {
      topic: function() {
        var callback = this.callback;
        smash.readAllImports(["test/invalid-import-syntax.js"], function(error) {
          callback(null, error);
        });
      },
      "throws an error with the expected message": function(error) {
        assert.deepEqual(error.message, "invalid import: test/invalid-import-syntax.js:0: import foo;");
      }
    },
    "on a file with that imports a file that does not exist": {
      topic: function() {
        var callback = this.callback;
        smash.readAllImports(["test/imports-not-found.js"], function(error) {
          callback(null, error);
        });
      },
      "throws an error with the expected message": function(error) {
        assert.deepEqual(error.message, "ENOENT, open 'test/not-found.js'");
      }
    },
    "on a file with a commented-out import": {
      topic: function() {
        smash.readAllImports(["test/commented-import.js"], this.callback);
      },
      "ignores the commented-out input": function(imports) {
        assert.deepEqual(imports, ["test/commented-import.js"]);
      }
    },
    "on a file with a not-commented-out import": {
      topic: function() {
        smash.readAllImports(["test/not-commented-import.js"], this.callback);
      },
      "does not ignore the not-commented-out import": function(imports) {
        assert.deepEqual(imports, ["test/foo.js", "test/not-commented-import.js"]);
      }
    },
    "on a file with one import": {
      topic: function() {
        smash.readAllImports(["test/imports-foo.js"], this.callback);
      },
      "returns the expected import followed by the input file": function(imports) {
        assert.deepEqual(imports, ["test/foo.js", "test/imports-foo.js"]);
      }
    },
    "on a file with multiple imports": {
      topic: function() {
        smash.readAllImports(["test/imports-foo-bar-baz.js"], this.callback);
      },
      "returns the imports in order of declaration": function(imports) {
        assert.deepEqual(imports, ["test/foo.js", "test/bar.js", "test/baz.js", "test/imports-foo-bar-baz.js"]);
      }
    },
    "on a file with nested imports": {
      topic: function() {
        smash.readAllImports(["test/imports-imports-foo.js"], this.callback);
      },
      "returns the imports in order of dependency": function(imports) {
        assert.deepEqual(imports, ["test/foo.js", "test/imports-foo.js", "test/imports-imports-foo.js"]);
      }
    },
    "on multiple input files": {
      topic: function() {
        smash.readAllImports(["test/foo.js", "test/bar.js", "test/baz.js"], this.callback);
      },
      "returns the expected imports, in order": function(imports) {
        assert.deepEqual(imports, ["test/foo.js", "test/bar.js", "test/baz.js"]);
      }
    },
    "with redundant input files": {
      topic: function() {
        smash.readAllImports(["test/foo.js", "test/foo.js"], this.callback);
      },
      "ignores the redundant imports": function(imports) {
        assert.deepEqual(imports, ["test/foo.js"]);
      }
    },
    "when a file that imports itself": {
      topic: function() {
        smash.readAllImports(["test/imports-self.js"], this.callback);
      },
      "the self-import has no effect": function(imports) {
        assert.deepEqual(imports, ["test/imports-self.js"]);
      }
    },
    "when circular imports are encountered": {
      topic: function() {
        smash.readAllImports(["test/imports-circular-foo.js"], this.callback);
      },
      "imports are returned in arbtirary order": function(imports) {
        assert.deepEqual(imports, ["test/imports-circular-bar.js", "test/imports-circular-foo.js"]);
      }
    }
  }
});

suite.export(module);
