/* render.js —— DOM 渲染层（只读数据、渲染页面，不参与解析/搜索逻辑） */
(function (global) {
  'use strict';

  function el(id) {
    return document.getElementById(id);
  }

  function esc(text) {
    return String(text).replace(/[&<>"']/g, function (ch) {
      switch (ch) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        default: return '&#39;';
      }
    });
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  // 渲染表达式输入区：每行一条，标注行号、状态（合法/非法/空行跳过）
  function renderLineStates(container, evaluation) {
    var html = '';
    evaluation.lines.forEach(function (entry) {
      if (entry.error) {
        html += '<div class="line-state line-bad">' +
          '<span class="line-no">第 ' + entry.lineNo + ' 条</span>' +
          '<code class="line-expr">' + esc(entry.expr) + '</code>' +
          '<span class="line-msg">✗ ' + esc(entry.error) + '</span>' +
          '</div>';
      } else {
        html += '<div class="line-state line-ok">' +
          '<span class="line-no">第 ' + entry.lineNo + ' 条</span>' +
          '<code class="line-expr">' + esc(entry.expr) + '</code>' +
          '<span class="line-msg">✓ 合法</span>' +
          '</div>';
      }
    });
    if (html === '') html = '<div class="muted">还没有输入表达式（空行与 # 开头的注释行会被跳过）。</div>';
    container.innerHTML = html;
  }

  // 渲染合并后的触发时间总表
  function renderTable(container, evaluation, limit) {
    var rows = evaluation.results;
    var shown = limit ? rows.slice(0, limit) : rows;
    var html = '';
    html += '<div class="table-meta">共 ' + rows.length + ' 个触发时间（升序），下表展示前 ' + shown.length + ' 个</div>';
    html += '<table><thead><tr><th>#</th><th>触发时间</th><th>来源表达式</th><th>条目</th></tr></thead><tbody>';
    for (var i = 0; i < shown.length; i++) {
      var r = shown[i];
      html += '<tr>' +
        '<td class="num">' + (i + 1) + '</td>' +
        '<td class="time">' + esc(global.CronSchedule.formatParts(r.parts)) + '</td>' +
        '<td><code>' + esc(r.expr) + '</code></td>' +
        '<td class="num">第 ' + r.lineNo + ' 条</td>' +
        '</tr>';
    }
    html += '</tbody></table>';
    if (shown.length === 0) html = '<div class="muted">没有可显示的触发时间。</div>';
    container.innerHTML = html;
  }

  function renderSummary(container, evaluation, elapsedMs) {
    var valid = evaluation.lines.filter(function (l) { return !l.error; }).length;
    var bad = evaluation.errors.length;
    container.innerHTML = '合法表达式 <b>' + valid + '</b> 条 · 非法 <b>' + bad + '</b> 条 · ' +
      '合并触发时间 <b>' + evaluation.results.length + '</b> 个 · 计算耗时 <b>' + elapsedMs + ' ms</b>';
  }

  function renderSelfTest(container, report) {
    var head = '<div class="test-summary ' + (report.failed === 0 ? 'all-pass' : 'has-fail') + '">' +
      '自测结果：' + report.passed + ' / ' + report.total + ' 通过' +
      (report.failed === 0 ? ' 🎉 全部通过' : '，' + report.failed + ' 条失败') +
      '</div>';
    var body = '<div class="test-list">';
    report.results.forEach(function (r) {
      body += '<div class="test-item ' + (r.ok ? 'pass' : 'fail') + '">' +
        '<span class="test-badge">' + (r.ok ? 'PASS' : 'FAIL') + '</span>' +
        '<span class="test-index">#' + r.index + '</span>' +
        '<span class="test-name">' + esc(r.name) + '</span>';
      if (!r.ok) {
        body += '<div class="test-detail"><div>期望：<code>' + esc(r.expected) + '</code></div>' +
          '<div>实际：<code>' + esc(r.actual) + '</code></div></div>';
      }
      body += '</div>';
    });
    body += '</div>';
    container.innerHTML = head + body;
  }

  function nowStamp() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  global.CronRender = {
    el: el,
    esc: esc,
    renderLineStates: renderLineStates,
    renderTable: renderTable,
    renderSummary: renderSummary,
    renderSelfTest: renderSelfTest,
    nowStamp: nowStamp
  };
})(typeof window !== 'undefined' ? window : globalThis);