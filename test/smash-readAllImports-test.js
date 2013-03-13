var vows = require("vows"),
    assert = require("assert"),
    smash = require("../");

var suite = vows.describe("smash.readAllImports");

suite.addBatch({
  "on a file with no imports": {
    topic: function() {
      smash.readAllImports(["test/foo.js"], this.callback);
    },
    "returns only the input file": function(imports) {
      assert.deepEqual(imports, ["test/foo.js"]);
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
    "returns the expected imports, in order": function(imports) {
      assert.deepEqual(imports, ["test/foo.js", "test/bar.js", "test/baz.js", "test/imports-foo-bar-baz.js"]);
    }
  },
  "on a file with nested imports": {
    topic: function() {
      smash.readAllImports(["test/imports-imports-foo.js"], this.callback);
    },
    "returns the expected imports, in order": function(imports) {
      assert.deepEqual(imports, ["test/foo.js", "test/imports-foo.js", "test/imports-imports-foo.js"]);
    }
  }
});

suite.export(module);
