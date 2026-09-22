/* selftest.js —— 内置自测（至少 15 条断言，全部用固定起点，结果确定） */
(function (global) {
  'use strict';

  var parser = (typeof require !== 'undefined' && typeof module !== 'undefined' && module.exports)
    ? require('./parser.js')
    : global.CronParser;
  var fields = (typeof require !== 'undefined' && typeof module !== 'undefined' && module.exports)
    ? require('./fields.js')
    : global.CronFields;
  var schedule = (typeof require !== 'undefined' && typeof module !== 'undefined' && module.exports)
    ? require('./schedule.js')
    : global.CronSchedule;

  function values(expr, field) {
    var ast = parser.parseExpression(expr);
    return ast[field];
  }

  function times(expr, count, start) {
    var s = fields.buildSchedule(parser.parseExpression(expr));
    return schedule.findTriggers(s, count, start).map(schedule.formatParts);
  }

  function expectThrow(expr, fragment) {
    try {
      parser.parseExpression(expr);
      return { ok: false, expected: '抛出包含 "' + fragment + '" 的错误', actual: '没有报错' };
    } catch (e) {
      if (e.message.indexOf(fragment) === -1) {
        return { ok: false, expected: '错误信息包含 "' + fragment + '"', actual: e.message };
      }
      return { ok: true };
    }
  }

  function eq(actual, expected) {
    var aj = JSON.stringify(actual);
    var ej = JSON.stringify(expected);
    return { ok: aj === ej, expected: ej, actual: aj };
  }

  function isSortedUnique(list) {
    for (var i = 1; i < list.length; i++) {
      if (schedule.compareParts(list[i - 1], list[i]) >= 0) return false;
    }
    return true;
  }

  function buildTests() {
    var T = [];
    function test(name, fn) { T.push({ name: name, fn: fn }); }

    test('单星号全展开（分字段 * = 0..59）', function () {
      return eq(values('* * * * *', 'minute').length, 60);
    });

    test('逗号列表（时字段 9,12,18）', function () {
      return eq(values('0 9,12,18 * * *', 'hour'), [9, 12, 18]);
    });

    test('区间（周 1-5）', function () {
      return eq(values('0 9 * * 1-5', 'dow'), [1, 2, 3, 4, 5]);
    });

    test('步进（*/15）', function () {
      return eq(values('*/15 * * * *', 'minute'), [0, 15, 30, 45]);
    });

    test('区间加步进（3-30/5）', function () {
      return eq(values('3-30/5 * * * *', 'minute'), [3, 8, 13, 18, 23, 28]);
    });

    test('月份英文缩写（JAN-MAR 大小写混用）', function () {
      return eq(values('0 0 1 jan-Mar *', 'month'), [1, 2, 3]);
    });

    test('周英文缩写（MON,FRI）', function () {
      return eq(values('0 9 * * MON,fri', 'dow'), [1, 5]);
    });

    test('日周同时指定取“或”：0 0 8 * MON，2027-03-06 起下一次是 3/8（周一）', function () {
      var r = times('0 0 8 * MON', 1, [2027, 3, 6, 0, 0]);
      return eq(r, ['2027-03-08 00:00']);
    });

    test('日周取“或”再下一次是 3/15（周一，同时满足两者）', function () {
      var r = times('0 0 8 * MON', 2, [2027, 3, 6, 0, 0]);
      return eq(r, ['2027-03-08 00:00', '2027-03-15 00:00']);
    });

    test('平年 2 月没有 29 日：2027-03-01 之后 "0 0 29 2 *" 首次为 2028-02-29', function () {
      var r = times('0 0 29 2 *', 1, [2027, 3, 1, 0, 0]);
      return eq(r, ['2028-02-29 00:00']);
    });

    test('再连续四次应落在 2032-02-29（题目给定的检查落点）', function () {
      var r = times('0 0 29 2 *', 2, [2027, 3, 1, 0, 0]);
      return eq(r, ['2028-02-29 00:00', '2032-02-29 00:00']);
    });

    test('闰年 2 月有 29 日：从 2027 年起前两个 2-29 年份为 2028、2032', function () {
      return eq([fields.isLeapYear(2027), fields.isLeapYear(2028), fields.isLeapYear(2032)], [false, true, true]);
    });

    test('整百年 2100 不是闰年，2400 是闰年', function () {
      return eq([fields.isLeapYear(2100), fields.isLeapYear(2400)], [false, true]);
    });

    test('31 日只落在 1/3/5/7/8/10/12 月：2027-01-31 起前 3 次', function () {
      var r = times('0 0 31 * *', 3, [2027, 1, 31, 0, 0]);
      return eq(r, ['2027-01-31 00:00', '2027-03-31 00:00', '2027-05-31 00:00']);
    });

    test('跨年边界：从 2027-12-30 起 "0 0 1 1 *" 为 2028-01-01', function () {
      var r = times('0 0 1 1 *', 1, [2027, 12, 30, 0, 0]);
      return eq(r, ['2028-01-01 00:00']);
    });

    test('反区间 20-15 必须报错', function () {
      return expectThrow('* * * * 20-15', '反区间');
    });

    test('非法字符定位到段：第3段 abc', function () {
      return expectThrow('* * abc * *', '第3段');
    });

    test('非法字符定位到段：第2段 9a', function () {
      return expectThrow('0 9a * * *', '第2段');
    });

    test('越界值报错：小时 24', function () {
      return expectThrow('0 24 * * *', '第2段');
    });

    test('段数不对报错：只有 4 段', function () {
      return expectThrow('0 9 * *', '5 段');
    });

    test('多表达式合并排序（周五触发 0 9 * * FRI 与 0 0 8 * MON）', function () {
      var out = schedule.evaluateLines('0 0 8 * MON' + '\n' + '0 9 * * FRI', 3, [2027, 3, 6, 0, 0]);
      var merged = out.results.map(function (r) {
        return schedule.formatParts(r.parts) + ' [第' + r.lineNo + '条]';
      });
      return eq(merged, [
        '2027-03-08 00:00 [第1条]',
        '2027-03-12 09:00 [第2条]',
        '2027-03-15 00:00 [第1条]',
        '2027-03-19 09:00 [第2条]',
        '2027-03-22 00:00 [第1条]',
        '2027-03-26 09:00 [第2条]'
      ]);
    });

    test('某条非法不影响其它条：第2条非法时仍返回第1条结果并记录错误', function () {
      var out = schedule.evaluateLines('0 0 1 * *' + '\n' + '61 * * * *', 2, [2027, 3, 1, 0, 0]);
      var merged = out.results.map(function (r) { return schedule.formatParts(r.parts); });
      return eq({
        times: merged,
        errorLine: out.errors.length === 1 ? out.errors[0].lineNo : -1,
        errorHint: out.errors.length === 1 ? out.errors[0].message.indexOf('第1段') !== -1 : false
      }, {
        times: ['2027-03-01 00:00', '2027-04-01 00:00'],
        errorLine: 2,
        errorHint: true
      });
    });

    test('1000 次触发升序且无重复（* */2 * * *）', function () {
      var s = fields.buildSchedule(parser.parseExpression('* */2 * * *'));
      var list = schedule.findTriggers(s, 1000, [2027, 1, 1, 0, 0]);
      return eq({ count: list.length, sortedUnique: list.length === 1000 && isSortedUnique(list) },
        { count: 1000, sortedUnique: true });
    });

    test('同一表达式同一起点两次运行逐项一致', function () {
      var expr = '7 */3 1-15 jan,JUL,oct mon-fri/2';
      var a = times(expr, 1000, [2027, 6, 15, 12, 30]);
      var b = times(expr, 1000, [2027, 6, 15, 12, 30]);
      return eq(a, b);
    });

    test('周日 7 与 0 等价（0 0 * * 7 与 0 0 * * 0 结果相同）', function () {
      var a = times('0 0 * * 7', 2, [2027, 3, 1, 0, 0]);
      var b = times('0 0 * * 0', 2, [2027, 3, 1, 0, 0]);
      return eq(a, b);
    });

    test('触发搜索对起点是分钟级“之后”：起点 09:01 则不含当天 09:00，落到次日', function () {
      var r = times('0 9 * * *', 1, [2027, 3, 8, 9, 1]);
      return eq(r, ['2027-03-09 09:00']);
    });

    test('真实流程：从 2027-03-08 09:00 这一分钟发起（起点为下一分钟）结果是次日 09:00', function () {
      var start = schedule.partsFromDate(new Date(2027, 2, 8, 9, 0, 0));
      start[4] += 1;
      schedule.normalize(start);
      var r = times('0 9 * * *', 1, start);
      return eq(r, ['2027-03-09 09:00']);
    });

    test('整表 1000 次性能不超过 1 秒', function () {
      var s = fields.buildSchedule(parser.parseExpression('0 9 1-5 1,6,12 mon-fri'));
      var t0 = Date.now();
      var list = schedule.findTriggers(s, 1000, [2027, 1, 1, 0, 0]);
      var ms = Date.now() - t0;
      return eq({ count: list.length, within1s: ms <= 1000 }, { count: 1000, within1s: true });
    });

    return T;
  }

  function runAll() {
    var tests = buildTests();
    var results = [];
    var passed = 0;
    for (var i = 0; i < tests.length; i++) {
      var r;
      try {
        r = tests[i].fn();
      } catch (e) {
        r = { ok: false, expected: '断言正常执行', actual: '抛出异常：' + e.message };
      }
      if (r.ok) passed += 1;
      results.push({
        index: i + 1,
        name: tests[i].name,
        ok: !!r.ok,
        expected: r.expected,
        actual: r.actual
      });
    }
    return { total: tests.length, passed: passed, failed: tests.length - passed, results: results };
  }

  var api = { runAll: runAll };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.CronSelfTest = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
