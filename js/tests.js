window.CronTool = window.CronTool || {};
(function (ns) {
  'use strict';

  function ms(y, mo, d, h, mi) {
    return new Date(y, mo - 1, d, h || 0, mi || 0, 0, 0).getTime();
  }

  function fmt(v) {
    return typeof v === 'number' && v > 100000000000 ? ns.formatMinute(v) : JSON.stringify(v);
  }

  function assertEq(expected, actual) {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      throw { expected: fmt(expected), actual: fmt(actual) };
    }
  }

  function assertTrue(cond, expected, actual) {
    if (!cond) {
      throw { expected: expected, actual: actual };
    }
  }

  function mustParse(expr) {
    var r = ns.parseLine(expr);
    if (!r.ok) throw { expected: '解析成功', actual: r.message };
    return r.schedule;
  }

  function setOf(values) {
    var out = [];
    values.forEach(function (v, i) { if (v) out.push(i); });
    return out;
  }

  var tests = [
    {
      name: '单星号全展开（* * * * *）',
      run: function () {
        var s = mustParse('* * * * *');
        assertEq(60, setOf(s.minutes).length);
        assertEq(24, setOf(s.hours).length);
        assertEq(31, setOf(s.dom).length);
        assertEq(12, setOf(s.months).length);
        assertEq(7, setOf(s.dow).length);
      }
    },
    {
      name: '逗号列表（1,5,9）',
      run: function () {
        assertEq([1, 5, 9], setOf(mustParse('1,5,9 * * * *').minutes));
      }
    },
    {
      name: '区间（9-17）',
      run: function () {
        assertEq([9, 10, 11, 12, 13, 14, 15, 16, 17], setOf(mustParse('0 9-17 * * *').hours));
      }
    },
    {
      name: '步进（*/15）',
      run: function () {
        assertEq([0, 15, 30, 45], setOf(mustParse('*/15 * * * *').minutes));
      }
    },
    {
      name: '区间加步进（3-30/5）',
      run: function () {
        assertEq([3, 8, 13, 18, 23, 28], setOf(mustParse('3-30/5 * * * *').minutes));
      }
    },
    {
      name: '月英文缩写（jan,Dec 大小写混合）',
      run: function () {
        assertEq([1, 12], setOf(mustParse('0 0 1 jan,Dec *').months));
      }
    },
    {
      name: '周英文缩写（mon,FRI）',
      run: function () {
        assertEq([1, 5], setOf(mustParse('0 0 * * mon,FRI').dow));
      }
    },
    {
      name: '日周同时指定取满足其一（0 0 13 * MON）',
      run: function () {
        var s = mustParse('0 0 13 * MON');
        // 2026-09-22 是周二：下一个周一 09-28 早于下个 13 号，应命中周一
        assertEq(fmt(ms(2026, 9, 28)), fmt(ns.nextAfter(s, ms(2026, 9, 22))));
        // 周一 10-12 的 00:00 已过：下一个命中应是 13 号（周二），证明“日”一侧独立生效
        assertEq(fmt(ms(2026, 10, 13)), fmt(ns.nextAfter(s, ms(2026, 10, 12, 0, 1))));
      }
    },
    {
      name: '平年2月无29（2027-03-01 之后 → 2028-02-29）',
      run: function () {
        var s = mustParse('0 0 29 2 *');
        assertEq(fmt(ms(2028, 2, 29)), fmt(ns.nextAfter(s, ms(2027, 3, 1))));
      }
    },
    {
      name: '闰年2月有29（2028-01-01 → 2028-02-29）',
      run: function () {
        var s = mustParse('0 0 29 2 *');
        assertEq(fmt(ms(2028, 2, 29)), fmt(ns.nextAfter(s, ms(2028, 1, 1))));
      }
    },
    {
      name: '31日的月末（4月无31日 → 2026-05-31）',
      run: function () {
        var s = mustParse('0 0 31 * *');
        assertEq(fmt(ms(2026, 5, 31)), fmt(ns.nextAfter(s, ms(2026, 4, 1))));
      }
    },
    {
      name: '跨年边界（2026-12-31 23:59 → 2027-01-01 00:00）',
      run: function () {
        var s = mustParse('0 0 1 1 *');
        assertEq(fmt(ms(2027, 1, 1)), fmt(ns.nextAfter(s, ms(2026, 12, 31, 23, 59))));
      }
    },
    {
      name: '反区间报错并定位到段（20-15）',
      run: function () {
        var r = ns.parseLine('20-15 * * * *');
        assertTrue(!r.ok && r.message.indexOf('第1段') !== -1 && r.message.indexOf('大于终点') !== -1,
          '第1段报错且说明区间反了', r.ok ? '解析成功（不应成功）' : r.message);
      }
    },
    {
      name: '非法字符报错定位到段（第3段 abc）',
      run: function () {
        var r = ns.parseLine('0 0 abc * *');
        assertTrue(!r.ok && r.message.indexOf('第3段') !== -1 && r.message.indexOf('abc') !== -1,
          '第3段报错且包含 abc', r.ok ? '解析成功（不应成功）' : r.message);
      }
    },
    {
      name: '多表达式合并排序并标注来源',
      run: function () {
        var s1 = mustParse('30 9 * * *');
        var s2 = mustParse('0 9 * * *');
        var events = ns.mergeEvents(
          [{ schedule: s1, tag: 1 }, { schedule: s2, tag: 2 }],
          ms(2026, 9, 22), 4, 4);
        assertEq(
          [fmt(ms(2026, 9, 22, 9, 0)) + '@2', fmt(ms(2026, 9, 22, 9, 30)) + '@1',
           fmt(ms(2026, 9, 23, 9, 0)) + '@2', fmt(ms(2026, 9, 23, 9, 30)) + '@1'],
          events.map(function (e) { return fmt(e.time) + '@' + e.sources[0]; }));
      }
    },
    {
      name: '1000条升序无重复（*/7 * * * *）',
      run: function () {
        var s = mustParse('*/7 * * * *');
        var list = ns.listTriggers(s, ms(2026, 9, 22), 1000);
        assertEq(1000, list.length);
        for (var i = 1; i < list.length; i++) {
          if (list[i] <= list[i - 1]) {
            throw { expected: '严格升序', actual: '第' + i + '项 ' + fmt(list[i]) + ' <= 前一项 ' + fmt(list[i - 1]) };
          }
        }
      }
    },
    {
      name: '两次运行逐项一致（15 3,9 */3 * 1-5）',
      run: function () {
        var s = mustParse('15 3,9 */3 * 1-5');
        var a = ns.listTriggers(s, ms(2026, 9, 22), 1000);
        var b = ns.listTriggers(s, ms(2026, 9, 22), 1000);
        assertEq(a, b);
      }
    },
    {
      name: '周日可用 7 表示（0 0 * * 7）',
      run: function () {
        assertEq([0], setOf(mustParse('0 0 * * 7').dow));
      }
    },
    {
      name: '工作日9点（0 9 * * 1-5，周五 → 下周一）',
      run: function () {
        var s = mustParse('0 9 * * 1-5');
        // 2026-09-25 是周五，10:00 之后下一次是周一 2026-09-28 09:00
        assertEq(fmt(ms(2026, 9, 28, 9, 0)), fmt(ns.nextAfter(s, ms(2026, 9, 25, 10, 0))));
      }
    },
    {
      name: '性能：稀疏表达式 1000 次 < 1 秒（0 0 29 2 *）',
      run: function () {
        var s = mustParse('0 0 29 2 *');
        var t0 = (typeof performance !== 'undefined' ? performance : Date).now();
        var list = ns.listTriggers(s, ms(2026, 9, 22), 1000);
        var t1 = (typeof performance !== 'undefined' ? performance : Date).now();
        assertEq(1000, list.length);
        assertTrue(t1 - t0 < 1000, '耗时 < 1000 ms', '耗时 ' + (t1 - t0).toFixed(1) + ' ms');
      }
    }
  ];

  // 返回 { results: [{ name, pass, expected, actual }], elapsedMs }
  ns.runTests = function () {
    var t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    var results = tests.map(function (t) {
      try {
        t.run();
        return { name: t.name, pass: true };
      } catch (e) {
        return {
          name: t.name,
          pass: false,
          expected: (e && e.expected !== undefined) ? String(e.expected) : '（异常）',
          actual: (e && e.actual !== undefined) ? String(e.actual) : String(e && e.message || e)
        };
      }
    });
    var t1 = (typeof performance !== 'undefined' ? performance : Date).now();
    return { results: results, elapsedMs: t1 - t0 };
  };
})(window.CronTool);
