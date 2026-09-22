/* schedule.js —— 触发时间搜索
 * 从给定起点（含）开始逐日扫描，按 分/时 字段展开当天的触发时刻。
 * 日与周同时被指定（原文都不是 *）时，满足其一即可（标准 crontab 语义）。
 * 多表达式结果按时间升序合并，时间相同时按表达式行号稳定排序。
 */
(function (global) {
  'use strict';

  var parser = (typeof require !== 'undefined' && typeof module !== 'undefined' && module.exports)
    ? require('./parser.js')
    : global.CronParser;
  var fields = (typeof require !== 'undefined' && typeof module !== 'undefined' && module.exports)
    ? require('./fields.js')
    : global.CronFields;

  var MAX_YEAR = 9999;

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  // [年,月,日,时,分] -> "YYYY-MM-DD HH:mm"
  function formatParts(p) {
    return p[0] + '-' + pad2(p[1]) + '-' + pad2(p[2]) + ' ' + pad2(p[3]) + ':' + pad2(p[4]);
  }

  // Date -> 取整到分钟的 [年,月,日,时,分]（本地时区）
  function partsFromDate(date) {
    return [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()];
  }

  // 起点：当前时间取整到分钟后的“下一分钟”，即只搜索严格晚于当前时刻的触发
  function startPartsFromNow(now) {
    var p = partsFromDate(now || new Date());
    p[4] += 1;
    normalize(p);
    return p;
  }

  function compareParts(a, b) {
    for (var i = 0; i < 5; i++) {
      if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
    }
    return 0;
  }

  function sortKey(p) {
    return (((((p[0] * 13 + p[1]) * 32 + p[2]) * 24 + p[3]) * 60) + p[4]);
  }

  // 原地把越界的 分/时/日 进位
  function normalize(p) {
    if (p[4] > 59) { p[4] -= 60; p[3] += 1; }
    if (p[3] > 23) { p[3] -= 24; p[2] += 1; }
    var dim = fields.daysInMonth(p[0], p[1]);
    while (p[2] > dim) {
      p[2] -= dim;
      p[1] += 1;
      if (p[1] > 12) { p[1] = 1; p[0] += 1; }
      dim = fields.daysInMonth(p[0], p[1]);
    }
  }

  function advanceDay(p) {
    p[2] += 1;
    if (p[2] > fields.daysInMonth(p[0], p[1])) {
      p[2] = 1;
      p[1] += 1;
      if (p[1] > 12) {
        p[1] = 1;
        p[0] += 1;
      }
    }
  }

  function dayMatches(schedule, y, mo, d) {
    var domHit = !!schedule.dom[d];
    var dowHit = !!schedule.dow[fields.dayOfWeek(y, mo, d)];
    if (schedule.domRestricted && schedule.dowRestricted) return domHit || dowHit;
    if (schedule.domRestricted) return domHit;
    if (schedule.dowRestricted) return dowHit;
    return true;
  }

  // 从 startParts（含）向后搜索 count 个触发时间
  function findTriggers(schedule, count, startParts) {
    var p = startParts.slice();
    var results = [];
    var isFirstDay = true;

    while (results.length < count && p[0] <= MAX_YEAR) {
      var dayQualifies = !!schedule.month[p[1]] && dayMatches(schedule, p[0], p[1], p[2]);
      if (dayQualifies) {
        for (var h = 0; h <= 23; h++) {
          if (!schedule.hour[h]) continue;
          for (var mi = 0; mi <= 59; mi++) {
            if (!schedule.minute[mi]) continue;
            var candidate = [p[0], p[1], p[2], h, mi];
            if (isFirstDay && compareParts(candidate, startParts) < 0) continue;
            results.push(candidate);
            if (results.length === count) return results;
          }
        }
      }
      isFirstDay = false;
      advanceDay(p);
    }
    return results;
  }

  // 多行输入：返回 { lines:[{expr, schedule? ,error?}], results:[{parts,key,lineNo,expr}], errors:[...] }
  function evaluateLines(text, count, startParts) {
    var rawLines = String(text == null ? '' : text).split(/\r?\n/);
    var lineEntries = [];
    var allResults = [];
    var errors = [];

    for (var i = 0; i < rawLines.length; i++) {
      var raw = rawLines[i].trim();
      if (raw === '' || raw.charAt(0) === '#') continue;
      var entry = { lineNo: lineEntries.length + 1, expr: raw };
      try {
        var ast = parser.parseExpression(raw);
        var schedule = fields.buildSchedule(ast);
        entry.schedule = schedule;
        var triggers = findTriggers(schedule, count, startParts);
        for (var t = 0; t < triggers.length; t++) {
          allResults.push({
            parts: triggers[t],
            key: sortKey(triggers[t]),
            lineNo: entry.lineNo,
            expr: raw
          });
        }
      } catch (e) {
        entry.error = e.message;
        errors.push({ lineNo: entry.lineNo, expr: raw, message: e.message });
      }
      lineEntries.push(entry);
    }

    allResults.sort(function (a, b) {
      if (a.key !== b.key) return a.key - b.key;
      return a.lineNo - b.lineNo;
    });

    return { lines: lineEntries, results: allResults, errors: errors };
  }

  function evaluateSingle(expression, count, startParts) {
    var ast = parser.parseExpression(expression);
    var schedule = fields.buildSchedule(ast);
    var triggers = findTriggers(schedule, count, startParts);
    return triggers.map(function (p) {
      return { parts: p, key: sortKey(p), lineNo: 1, expr: expression.trim() };
    });
  }

  var api = {
    startPartsFromNow: startPartsFromNow,
    partsFromDate: partsFromDate,
    findTriggers: findTriggers,
    evaluateLines: evaluateLines,
    evaluateSingle: evaluateSingle,
    formatParts: formatParts,
    compareParts: compareParts,
    sortKey: sortKey,
    normalize: normalize
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.CronSchedule = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
