window.CronTool = window.CronTool || {};
(function (ns) {
  'use strict';

  var MONTH_NAMES = {
    JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
    JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
  };
  var DOW_NAMES = {
    SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6
  };

  function fail(message) {
    return { ok: false, message: message };
  }

  function toNum(token, def) {
    var up = token.toUpperCase();
    if (def.names && Object.prototype.hasOwnProperty.call(def.names, up)) {
      return def.names[up];
    }
    if (/^\d+$/.test(token)) {
      return parseInt(token, 10);
    }
    return null;
  }

  // def: { min, max, names?, sunday7? }
  // 返回 { ok:true, values:数组(下标即取值,true表示命中), isStar } 或 { ok:false, message }
  function expandField(expr, def) {
    var values = [];
    for (var i = def.min; i <= def.max; i++) values[i] = false;

    var trimmed = expr.trim();
    var isStar = trimmed === '*';
    var parts = trimmed.split(',');

    for (var p = 0; p < parts.length; p++) {
      var part = parts[p].trim();
      if (part === '') return fail('存在空的列表项（多余的逗号）');

      var step = 1;
      var base = part;
      var slash = part.indexOf('/');
      if (slash !== -1) {
        base = part.slice(0, slash);
        var stepStr = part.slice(slash + 1);
        if (base === '') return fail('步进缺少范围："' + part + '"');
        if (part.indexOf('/', slash + 1) !== -1) return fail('步进格式错误："' + part + '"');
        if (!/^\d+$/.test(stepStr) || parseInt(stepStr, 10) < 1) {
          return fail('步进必须是正整数："' + part + '"');
        }
        step = parseInt(stepStr, 10);
      }

      var lo, hi;
      if (base === '*') {
        lo = def.min;
        hi = def.max;
      } else {
        var dash = base.indexOf('-');
        if (dash !== -1) {
          var a = base.slice(0, dash);
          var b = base.slice(dash + 1);
          if (a === '' || b === '' || base.indexOf('-', dash + 1) !== -1) {
            return fail('区间格式错误："' + base + '"');
          }
          lo = toNum(a, def);
          hi = toNum(b, def);
          if (lo === null) return fail('无法识别 "' + a + '"');
          if (hi === null) return fail('无法识别 "' + b + '"');
          if (lo > hi) return fail('区间起点 ' + a + ' 大于终点 ' + b);
        } else {
          lo = toNum(base, def);
          if (lo === null) return fail('无法识别 "' + base + '"');
          hi = (slash !== -1) ? def.max : lo;
        }
      }

      if (lo < def.min || hi > def.max) {
        return fail('数值超出允许范围 ' + def.min + '-' + def.max + '："' + part + '"');
      }
      for (var v = lo; v <= hi; v += step) values[v] = true;
    }

    if (def.sunday7 && values[7]) {
      values[0] = true;
      values[7] = false;
    }
    return { ok: true, values: values, isStar: isStar };
  }

  ns.MONTH_NAMES = MONTH_NAMES;
  ns.DOW_NAMES = DOW_NAMES;
  ns.expandField = expandField;
})(window.CronTool);
