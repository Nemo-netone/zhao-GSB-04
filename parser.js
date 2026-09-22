/* parser.js —— cron 表达式解析（5 段：分 时 日 月 周）
 * 只负责语法解析与校验，产出 AST：
 *   { minute:[[num,...]], hour, dom, month, dow, domRestricted:bool, dowRestricted:bool }
 * 非法输入抛出 Error，message 明确指出第几段、错误内容。
 * 本文件同时可在 Node（自测脚本）中运行。
 */
(function (global) {
  'use strict';

  var FIELD_NAMES = ['minute', 'hour', 'dom', 'month', 'dow'];
  var FIELD_LABELS_ZH = ['第1段（分）', '第2段（时）', '第3段（日）', '第4段（月）', '第5段（周）'];
  var MIN_VALUE = [0, 0, 1, 1, 0];
  var MAX_VALUE = [59, 23, 31, 12, 7];

  var MONTH_ALIASES = {
    JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
    JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
  };
  var DOW_ALIASES = {
    SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6
  };

  function fail(fieldIndex, detail) {
    var err = new Error(FIELD_LABELS_ZH[fieldIndex] + ' ' + detail);
    err.fieldIndex = fieldIndex;
    throw err;
  }

  function resolveToken(fieldIndex, raw) {
    var token = raw.trim().toUpperCase();
    if (token === '*') return token;
    if (fieldIndex === 3 && Object.prototype.hasOwnProperty.call(MONTH_ALIASES, token)) {
      return String(MONTH_ALIASES[token]);
    }
    if (fieldIndex === 4 && Object.prototype.hasOwnProperty.call(DOW_ALIASES, token)) {
      return String(DOW_ALIASES[token]);
    }
    return token;
  }

  // 解析单个字段，返回排序去重后的数字数组
  function parseField(raw, fieldIndex) {
    var lo = MIN_VALUE[fieldIndex];
    var hi = MAX_VALUE[fieldIndex];
    var pieces = raw.split(',');
    var seen = Object.create(null);
    var values = [];

    for (var p = 0; p < pieces.length; p++) {
      var piece = pieces[p].trim();
      if (piece === '') fail(fieldIndex, '列表（逗号）里有空项："' + raw + '"');

      var step = 1;
      var base = piece;
      var slashPos = piece.indexOf('/');
      if (slashPos !== -1) {
        var stepPart = piece.slice(slashPos + 1);
        base = piece.slice(0, slashPos);
        if (stepPart === '' || !/^\d+$/.test(stepPart)) {
          fail(fieldIndex, '步进值必须是正整数，收到："/' + stepPart + '"');
        }
        step = parseInt(stepPart, 10);
        if (step <= 0) fail(fieldIndex, '步进值必须大于 0，收到："/' + step + '"');
      }

      var start;
      var end;
      if (base === '*') {
        start = lo;
        end = hi;
      } else if (base.indexOf('-') !== -1) {
        var rangeParts = base.split('-');
        if (rangeParts.length !== 2 || rangeParts[0] === '' || rangeParts[1] === '') {
          fail(fieldIndex, '区间格式应为 起-止，收到："' + base + '"');
        }
        var rawStart = resolveToken(fieldIndex, rangeParts[0]);
        var rawEnd = resolveToken(fieldIndex, rangeParts[1]);
        if (!/^\d+$/.test(rawStart) || !/^\d+$/.test(rawEnd)) {
          fail(fieldIndex, '区间端点无法识别："' + base + '"');
        }
        start = parseInt(rawStart, 10);
        end = parseInt(rawEnd, 10);
        if (start > end) {
          fail(fieldIndex, '区间起点不能大于终点（不支持反区间如 20-15），收到："' + base + '"');
        }
        if (start < lo || start > hi || end < lo || end > hi) {
          fail(fieldIndex, '数值超出范围（' + lo + '-' + hi + '），收到："' + base + '"');
        }
      } else {
        var single = resolveToken(fieldIndex, base);
        if (!/^\d+$/.test(single)) {
          fail(fieldIndex, '无法识别的字符或缩写："' + base + '"');
        }
        start = parseInt(single, 10);
        end = start;
        if (start < lo || start > hi) {
          fail(fieldIndex, '数值超出范围（' + lo + '-' + hi + '），收到："' + base + '"');
        }
      }

      for (var v = start; v <= end; v += step) {
        if (!seen[v]) {
          seen[v] = true;
          values.push(v);
        }
      }
    }

    return values.sort(function (a, b) { return a - b; });
  }

  function parseExpression(expression) {
    if (typeof expression !== 'string') throw new Error('表达式必须是字符串');
    var trimmed = expression.trim();
    if (trimmed === '') throw new Error('表达式为空');

    var segments = trimmed.split(/\s+/);
    if (segments.length !== 5) {
      throw new Error('表达式必须是 5 段（分 时 日 月 周），当前有 ' + segments.length + ' 段："' + trimmed + '"');
    }

    var ast = {};
    for (var i = 0; i < 5; i++) {
      var raw = segments[i];
      ast[FIELD_NAMES[i]] = parseField(raw, i);
    }

    // 周字段 7 与 0 都表示周日，统一归一化为 0
    if (ast.dow.indexOf(7) !== -1) {
      ast.dow = ast.dow.filter(function (d) { return d !== 7; });
      if (ast.dow.indexOf(0) === -1) ast.dow.push(0);
      ast.dow.sort(function (a, b) { return a - b; });
    }

    // 是否“被指定”：严格按原文是否等于 * 判定（*/n 属于被指定）
    ast.domRestricted = segments[2] !== '*';
    ast.dowRestricted = segments[4] !== '*';
    ast.raw = trimmed;
    return ast;
  }

  var api = {
    parseExpression: parseExpression,
    FIELD_NAMES: FIELD_NAMES,
    FIELD_LABELS_ZH: FIELD_LABELS_ZH
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.CronParser = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
