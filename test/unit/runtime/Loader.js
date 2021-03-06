// Copyright 2011 Traceur Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {suite, test, assert} from '../../unit/unitTestRunner.js';
import {getTestLoader} from '../../modular/getTestLoader.js';

suite('Loader.js', function() {

  function get(name) {
    return $traceurRuntime.ModuleStore.getForTesting(name);
  }

  var MutedErrorReporter = get('src/util/MutedErrorReporter.js').MutedErrorReporter;

  var reporter, baseURL;
  var saveMap;

  setup(function() {
    reporter = new traceur.util.ErrorReporter();
    baseURL = System.baseURL;
    saveMap = System.map;
  });

  teardown(function() {
    assert.isFalse(reporter.hadError());
    System.baseURL = baseURL;
    System.map = saveMap;
  });

  test('locate', function() {
    var loader = getTestLoader();
    var load = {
      metadata: {
        baseURL: 'http://example.org/a/'
      },
      data: {}
    }
    load.normalizedName = '@abc/def';
    assert.equal(loader.locate(load), 'http://example.org/a/@abc/def');
    load.normalizedName = 'abc/def';
    assert.equal(loader.locate(load), 'http://example.org/a/abc/def');
    load.normalizedName = 'abc/def.js';
    assert.equal(loader.locate(load), 'http://example.org/a/abc/def.js');
    load.normalizedName = './abc/def.js';
    assert.equal(loader.locate(load), 'http://example.org/a/abc/def.js');
  });

  test('traceur@', function() {
    var traceur = System.get('traceur@');
    var optionsModule = $traceurRuntime.ModuleStore.getForTesting('src/Options.js');
    assert.equal(traceur.util.Options, optionsModule.Options);
  });

  test('Loader.PreCompiledModule', function(done) {
    var traceur = System.get('traceur@');
    System.import('traceur@', {}).then(function(module) {
      assert.equal(traceur.util.Options, module.util.Options);
      done();
    }).catch(done);
  });

  test('Loader.Script', function(done) {
    getTestLoader().script('(function(x = 42) { return x; })()', {}).then(
      function(result) {
        assert.equal(42, result);
        done();
      }).catch(done);
  });

  test('Loader.Script.Named', function(done) {
    var loader = getTestLoader();
    var src = '(function(x = 43) { return x; })()';
    var name = '43';
    var metadata = {traceurOptions: {sourceMaps: true}};
    loader.script(src, {name: name, metadata: metadata}).then(
      function(result) {
        $traceurRuntime.options.sourceMaps = false;
        var normalizedName = System.normalize(name);
        var sourceMap = loader.getSourceMap(normalizedName);
        assert(sourceMap, 'the sourceMap is defined');
        assert.equal(43, result);
        done();
      }).catch(done);
  });

  test('Loader.Script.Fail', function(done) {
    var reporter = new MutedErrorReporter();
    getTestLoader(reporter).script('export var x = 5;', {}).then(
      function(result) {
        fail('should not have succeeded');
        done();
      }, function(ex) {
        assert(ex);
        done();
      }).catch(done);
  });

  test('LoaderModule', function(done) {
    var code =
        'import * as a from "./resources/test_a.js";\n' +
        'import * as b from "./resources/test_b.js";\n' +
        'import * as c from "./resources/test_c.js";\n' +
        '\n' +
        'export var arr = [\'test\', a.name, b.name, c.name];\n';

    var result = getTestLoader().module(code, {}).then(
      function(module) {
        assert.equal('test', module.arr[0]);
        assert.equal('A', module.arr[1]);
        assert.equal('B', module.arr[2]);
        assert.equal('C', module.arr[3]);
        assert.isNull(Object.getPrototypeOf(module));
        done();
      }).catch(done);
  });

  test('LoaderModuleWithSubdir', function(done) {
    var code =
        'import * as d from "./subdir/test_d.js";\n' +
        '\n' +
        'export var arr = [d.name, d.e.name];\n';

    var result = getTestLoader().module(code, {}).then(
      function(module) {
        assert.equal('D', module.arr[0]);
        assert.equal('E', module.arr[1]);
        done();
      }).catch(done);
  });

  test('LoaderModuleFail', function(done) {
    var code =
        'import * as a from "./resources/test_a.js";\n' +
        'import * as b from "./resources/test_b.js";\n' +
        'import * as c from "./resources/test_c.js";\n' +
        '\n' +
        '[\'test\', SYNTAX ERROR a.name, b.name, c.name];\n';

    var reporter = new MutedErrorReporter();

    var result = getTestLoader(reporter).module(code, {}).then(
      function(value) {
        fail('Should not have succeeded');
        done();
      }, function(error) {
        // TODO(jjb): We should probably get some meaningful error here.

        //assert.isTrue(reporter.hadError());
        assert.isTrue(true);
        done();
      }).catch(done);
  });

  test('LoaderLoad', function(done) {
    getTestLoader().loadAsScript('./resources/test_script.js', {}).then(function(result) {
      assert.equal('A', result[0]);
      assert.equal('B', result[1]);
      assert.equal('C', result[2]);
      done();
    }).catch(done);
  });

  test('LoaderLoad.Fail', function(done) {
    var reporter = new MutedErrorReporter();
    getTestLoader(reporter).loadAsScript('./resources/non_existing.js', {}).then(function(result) {
      fail('should not have succeeded');
      done();
    }, function(error) {
      assert(error);
      done();
    }).catch(done);
  });

  test('Loader.LoadAsScriptAll', function(done) {
    var names = ['./resources/test_script.js'];
    getTestLoader().loadAsScriptAll(names, {}).then(function(results) {
      var result = results[0];
      assert.equal('A', result[0]);
      assert.equal('B', result[1]);
      assert.equal('C', result[2]);
      done();
    }).catch(done);
  });

  test('LoaderImport', function(done) {
    getTestLoader().import('./resources/test_module.js', {}).then(function(mod) {
      assert.equal('test', mod.name);
      assert.equal('A', mod.a);
      assert.equal('B', mod.b);
      assert.equal('C', mod.c);
      done();
    }).catch(done);
  });

  test('LoaderImportAll', function(done) {
    var names = ['./resources/test_module.js'];
    getTestLoader().importAll(names, {}).then(function(mods) {
      var mod = mods[0];
      assert.equal('test', mod.name);
      assert.equal('A', mod.a);
      assert.equal('B', mod.b);
      assert.equal('C', mod.c);
      done();
    }).catch(done);
  });

  // TODO: Update Traceur loader implementation to support new instantiate output
  /* test('LoaderDefine.Instantiate', function(done) {
    var loader = getTestLoader();
    $traceurRuntime.options.modules = 'instantiate';
    var name = './test_instantiate.js';
    var src = 'export {name as a} from \'./test_a.js\';\n' +
    'export var dd = 8;\n';
    loader.define(name, src).then(function() {
      return loader.import(name);
    }).then(function(mod) {
        assert.equal(8, mod.dd);
        done();
    }).catch(done);
  }); */

  test('LoaderImport.Fail', function(done) {
    var reporter = new MutedErrorReporter();
    getTestLoader(reporter).import('./resources/non_existing.js', {}).then(function(mod) {
      fail('should not have succeeded')
      done();
    }, function(error) {
      assert(error);
      done();
    }).catch(done);
  });

  test('LoaderImport.Fail.deperror', function(done) {
    var reporter = new MutedErrorReporter();
    var metadata = {traceurOptions: {sourceMaps: 'memory'}};
    getTestLoader(reporter).import('loads/main.js', {metadata: metadata}).then(
      function(mod) {
        fail('should not have succeeded')
        done();
      }, function(error) {
        assert((error + '').indexOf('ModuleEvaluationError: dep error in') !== -1);
        assert((error.stack + '').indexOf('eval at <anonymous>') === -1,
            '<eval> stacks are converted.');
        done();
      }).catch(done);
  });

  test('Loader.define', function(done) {
    var name = System.normalize('./test_define.js');
    getTestLoader().import('./resources/side-effect.js', {}).then(function(mod) {
      assert.equal(6, mod.currentSideEffect());  // starting value.
      var src = 'export {name as a} from \'./resources/test_a.js\';\n' +
        'export var d = 4;\n' + 'this.sideEffect++;';
      return getTestLoader().define(name, src, {}).then(function() {
        return mod;
      });
    }).then(function(mod) {
      assert.equal(6, mod.currentSideEffect());  // no change
      var definedModule = System.get(name);
      assert.equal(7, mod.currentSideEffect());  // module body evaluated
      assert.equal(4, definedModule.d);  // define does exports
      assert.equal('A', definedModule.a);  // define does imports
      done();
    }).catch(done);
  });

  test('Loader.define.Fail', function(done) {
    var name = System.normalize('./test_define.js');
    getTestLoader().import('./resources/side-effect.js', {}).then(function(mod) {
      var src = 'syntax error';
      getTestLoader().define(name, src, {}).then(function() {
          fail('should not have succeeded');
          done();
        }, function(error) {
          assert(error);
          done();
        });
    }).catch(done);
  });

  test('Loader.defineWithSourceMap', function(done) {
    var normalizedName = System.normalize('./test_define_with_source_map.js');
    var loader = getTestLoader();
    var metadata = {traceurOptions: {sourceMaps: true}};
    var src = 'export {name as a} from \'./resources/test_a.js\';\nexport var d = 4;\n';
    loader.define(normalizedName, src, {metadata: metadata}).then(function() {
      var sourceMap = loader.getSourceMap(normalizedName);
      assert(sourceMap, normalizedName + ' has a sourceMap');
      var SourceMapConsumer = traceur.outputgeneration.SourceMapConsumer;
      var consumer = new SourceMapConsumer(sourceMap);
      var sourceContent = consumer.sourceContentFor(normalizedName);
      assert.equal(sourceContent, src, 'the sourceContent is correct');
      done();
    }).catch(done);
  });

  test('import with metadata having junk', function(done) {
    var loader = getTestLoader();
    let consoleWarn = console.warn;
    var actualWarning = '';
    console.warn = function(msg) {
      actualWarning = msg;
    };
    var metadata = {traceurOptions: {junk: true}};
    getTestLoader().import('./resources/test_module.js', {metadata: metadata}).
        then(function(mod) {
          assert.equal(actualWarning,
            'Unknown metadata.traceurOptions ignored: junk');
          console.warn = consoleWarn;
          done();
      }).catch(done);
  });

});
