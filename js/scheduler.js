window.CronTool = window.CronTool || {};
(function (ns) {
  'use strict';

  // 单次“下次触发”最多向后搜索的年数（防止永不命中的表达式死循环）
  var SEARCH_YEAR_LIMIT = 8;
  var GUARD_LIMIT = 5000000;

  // 日/周匹配规则：两者都被指定（都不是 *）时满足其一即可
  function dayMatches(sched, d) {
    var domMatch = !!sched.dom[d.getDate()];
    var dowMatch = !!sched.dow[d.getDay()];
    if (sched.domStar && sched.dowStar) return true;
    if (sched.domStar) return dowMatch;
    if (sched.dowStar) return domMatch;
    return domMatch || dowMatch;
  }

  // 返回 fromMs 之后（不含 fromMs 所在分钟）的下次触发时间戳，找不到返回 null
  function nextAfter(sched, fromMs) {
    var t = new Date(fromMs);
    t.setSeconds(0, 0);
    t = new Date(t.getTime() + 60000);
    var limitYear = t.getFullYear() + SEARCH_YEAR_LIMIT;
    var guard = 0;

    while (t.getFullYear() <= limitYear && guard < GUARD_LIMIT) {
      guard++;
      if (!sched.months[t.getMonth() + 1]) {
        t = new Date(t.getFullYear(), t.getMonth() + 1, 1, 0, 0, 0, 0);
        continue;
      }
      if (!dayMatches(sched, t)) {
        t = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1, 0, 0, 0, 0);
        continue;
      }
      if (!sched.hours[t.getHours()]) {
        t = new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours() + 1, 0, 0, 0);
        continue;
      }
      if (!sched.minutes[t.getMinutes()]) {
        t = new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), t.getMinutes() + 1, 0, 0, 0);
        continue;
      }
      return t.getTime();
    }
    return null;
  }

  // 生成 count 个触发时间（严格升序、无重复）；表达式永不命中时返回已找到的部分
  function listTriggers(sched, fromMs, count) {
    var out = [];
    var cursor = fromMs;
    while (out.length < count) {
      var next = nextAfter(sched, cursor);
      if (next === null) break;
      out.push(next);
      cursor = next;
    }
    return out;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function formatMinute(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  var WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

  function formatWeekday(ms) {
    return '周' + WEEK_LABELS[new Date(ms).getDay()];
  }

  // items: [{ schedule, tag }]；合并各表达式的触发时间为一张升序总表
  // 同一时刻被多条表达式命中时合并为一行，sources 记录所有来源 tag
  function mergeEvents(items, fromMs, perExprCount, totalCap) {
    var all = [];
    items.forEach(function (item) {
      var times = listTriggers(item.schedule, fromMs, perExprCount);
      times.forEach(function (t) {
        all.push({ time: t, tag: item.tag });
      });
    });
    all.sort(function (a, b) { return a.time - b.time; });

    var events = [];
    for (var i = 0; i < all.length && events.length < totalCap; i++) {
      var last = events[events.length - 1];
      if (last && last.time === all[i].time) {
        last.sources.push(all[i].tag);
      } else {
        events.push({ time: all[i].time, sources: [all[i].tag] });
      }
    }
    return events;
  }

  ns.dayMatches = dayMatches;
  ns.nextAfter = nextAfter;
  ns.listTriggers = listTriggers;
  ns.mergeEvents = mergeEvents;
  ns.formatMinute = formatMinute;
  ns.formatWeekday = formatWeekday;
})(window.CronTool);
