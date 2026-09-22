window.CronTool = window.CronTool || {};
(function (ns) {
  'use strict';

  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function makeEl(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  // errors: [{ lineNo, text, message }]
  function renderErrors(container, errors) {
    clear(container);
    if (!errors.length) return;
    container.appendChild(makeEl('h2', null, '表达式错误（' + errors.length + '）'));
    var ul = makeEl('ul', 'error-list');
    errors.forEach(function (e) {
      var li = makeEl('li', 'error-item');
      li.appendChild(makeEl('span', 'error-line', '第' + e.lineNo + '行'));
      li.appendChild(makeEl('code', 'error-expr', e.text));
      li.appendChild(makeEl('span', 'error-msg', e.message));
      ul.appendChild(li);
    });
    container.appendChild(ul);
  }

  // events: [{ time, sources:[lineNo...] }]
  function renderTable(container, events, elapsedMs, exprCount) {
    clear(container);
    if (!events.length) {
      container.appendChild(makeEl('p', 'empty-tip',
        exprCount > 0 ? '没有可计算的触发时间' : '请在左侧输入 cron 表达式（一行一条）'));
      return;
    }
    container.appendChild(makeEl('p', 'summary',
      '共 ' + events.length + ' 次触发（合并 ' + exprCount + ' 条有效表达式，耗时 ' +
      elapsedMs.toFixed(1) + ' ms）'));

    var table = makeEl('table', 'result-table');
    var thead = makeEl('thead');
    var headRow = makeEl('tr');
    ['#', '触发时间', '星期', '来源表达式'].forEach(function (h) {
      headRow.appendChild(makeEl('th', null, h));
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = makeEl('tbody');
    var frag = document.createDocumentFragment();
    events.forEach(function (ev, i) {
      var tr = makeEl('tr');
      tr.appendChild(makeEl('td', 'col-idx', String(i + 1)));
      tr.appendChild(makeEl('td', 'col-time', ns.formatMinute(ev.time)));
      tr.appendChild(makeEl('td', 'col-week', ns.formatWeekday(ev.time)));
      var srcTd = makeEl('td', 'col-src');
      ev.sources.forEach(function (s) {
        srcTd.appendChild(makeEl('span', 'src-tag', '第' + s + '行'));
      });
      tr.appendChild(srcTd);
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
    table.appendChild(tbody);
    container.appendChild(table);
  }

  // results: [{ name, pass, expected, actual, message }]
  function renderTests(container, results, elapsedMs) {
    clear(container);
    var passed = results.filter(function (r) { return r.pass; }).length;
    var head = makeEl('h2', null,
      '自测结果：' + passed + '/' + results.length + ' 通过（' + elapsedMs.toFixed(1) + ' ms）');
    head.className = passed === results.length ? 'tests-all-pass' : 'tests-has-fail';
    container.appendChild(head);

    var ul = makeEl('ul', 'test-list');
    results.forEach(function (r) {
      var li = makeEl('li', r.pass ? 'test-pass' : 'test-fail');
      li.appendChild(makeEl('span', 'test-status', r.pass ? '✓ 通过' : '✗ 失败'));
      li.appendChild(makeEl('span', 'test-name', r.name));
      if (!r.pass) {
        var detail = makeEl('div', 'test-detail');
        detail.appendChild(makeEl('div', null, '期望：' + r.expected));
        detail.appendChild(makeEl('div', null, '实际：' + r.actual));
        li.appendChild(detail);
      }
      ul.appendChild(li);
    });
    container.appendChild(ul);
  }

  ns.render = {
    renderErrors: renderErrors,
    renderTable: renderTable,
    renderTests: renderTests
  };
})(window.CronTool);
