window.CronTool = window.CronTool || {};
(function (ns) {
  'use strict';

  var FIELD_DEFS = [
    { label: '分钟', min: 0, max: 59 },
    { label: '小时', min: 0, max: 23 },
    { label: '日', min: 1, max: 31 },
    { label: '月', min: 1, max: 12, names: null },
    { label: '星期', min: 0, max: 7, names: null, sunday7: true }
  ];

  function getFieldDefs() {
    var defs = FIELD_DEFS.map(function (d) {
      return {
        label: d.label, min: d.min, max: d.max,
        names: d.names, sunday7: d.sunday7
      };
    });
    defs[3].names = ns.MONTH_NAMES;
    defs[4].names = ns.DOW_NAMES;
    return defs;
  }

  // 解析一行 cron 表达式（5 段：分 时 日 月 周）
  // 返回 { ok:true, schedule } 或 { ok:false, message }
  function parseLine(line) {
    var parts = line.trim().split(/\s+/);
    if (parts.length !== 5) {
      return {
        ok: false,
        message: '需要 5 段（分 时 日 月 周），实际为 ' + parts.length + ' 段'
      };
    }
    var defs = getFieldDefs();
    var expanded = [];
    for (var i = 0; i < 5; i++) {
      var r = ns.expandField(parts[i], defs[i]);
      if (!r.ok) {
        return {
          ok: false,
          message: '第' + (i + 1) + '段（' + defs[i].label + '）：' + r.message
        };
      }
      expanded.push(r);
    }
    return {
      ok: true,
      schedule: {
        minutes: expanded[0].values,
        hours: expanded[1].values,
        dom: expanded[2].values,
        months: expanded[3].values,
        dow: expanded[4].values,
        domStar: expanded[2].isStar,
        dowStar: expanded[4].isStar
      }
    };
  }

  ns.parseLine = parseLine;
})(window.CronTool);
