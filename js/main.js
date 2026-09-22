(function (ns) {
  'use strict';

  var inputEl, errorsEl, tableEl, testsEl;

  function compute() {
    var lines = inputEl.value.split('\n');
    var parsed = [];
    lines.forEach(function (line, i) {
      if (!line.trim()) return;
      var r = ns.parseLine(line);
      parsed.push({
        lineNo: i + 1,
        text: line.trim(),
        ok: r.ok,
        schedule: r.schedule,
        message: r.message
      });
    });

    var errors = parsed.filter(function (p) { return !p.ok; });
    ns.render.renderErrors(errorsEl, errors);

    var valid = parsed.filter(function (p) { return p.ok; });
    var t0 = performance.now();
    var events = ns.mergeEvents(
      valid.map(function (p) { return { schedule: p.schedule, tag: p.lineNo }; }),
      Date.now(), 1000, 1000);
    var elapsed = performance.now() - t0;
    ns.render.renderTable(tableEl, events, elapsed, valid.length);
  }

  var debounceTimer = null;
  function scheduleCompute() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(compute, 300);
  }

  function runTests() {
    var outcome = ns.runTests();
    ns.render.renderTests(testsEl, outcome.results, outcome.elapsedMs);
  }

  document.addEventListener('DOMContentLoaded', function () {
    inputEl = document.getElementById('cron-input');
    errorsEl = document.getElementById('errors');
    tableEl = document.getElementById('results');
    testsEl = document.getElementById('test-results');

    document.getElementById('run-btn').addEventListener('click', compute);
    document.getElementById('test-btn').addEventListener('click', runTests);
    inputEl.addEventListener('input', scheduleCompute);
    compute();
  });
})(window.CronTool);
