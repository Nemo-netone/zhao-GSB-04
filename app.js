/* app.js —— 页面入口：接线 输入 -> 解析/搜索 -> 渲染 */
(function () {
  'use strict';

  var DEFAULT_COUNT = 1000;

  function compute() {
    var textarea = CronRender.el('cronInput');
    var count = parseInt(CronRender.el('countInput').value, 10);
    if (!(count > 0)) count = DEFAULT_COUNT;

    var startParts = CronSchedule.startPartsFromNow(new Date());
    CronRender.el('baseTime').textContent = '基准时间（当前，向后算）：' + CronRender.nowStamp();

    var t0 = performance.now();
    var evaluation = CronSchedule.evaluateLines(textarea.value, count, startParts);
    var t1 = performance.now();

    CronRender.renderSummary(CronRender.el('summary'), evaluation, Math.round(t1 - t0));
    CronRender.renderLineStates(CronRender.el('lineStates'), evaluation);
    CronRender.renderTable(CronRender.el('resultTable'), evaluation, count);
  }

  function runSelfTest() {
    var panel = CronRender.el('testPanel');
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    CronRender.el('testOutput').innerHTML = '<div class="muted">自测运行中…</div>';
    // 让浏览器先渲染提示，再执行（断言同步很快，这里仅保证提示可见）
    setTimeout(function () {
      var report = CronSelfTest.runAll();
      CronRender.renderSelfTest(CronRender.el('testOutput'), report);
    }, 10);
  }

  function init() {
    CronRender.el('runBtn').addEventListener('click', compute);
    CronRender.el('testBtn').addEventListener('click', runSelfTest);
    CronRender.el('cronInput').addEventListener('input', compute);
    compute();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();