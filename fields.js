/* fields.js —— 字段展开与月历工具
 * 把解析 AST 转为带 Set 查表的调度结构，并提供：
 *   isLeapYear(y)、daysInMonth(y,m)、dayOfWeek(y,m,d)
 * 周几用 Sakamoto 公式纯手工计算（0=周日 … 6=周六），不依赖运行环境时区。
 */
(function (global) {
  'use strict';

  function toSet(values) {
    var s = Object.create(null);
    for (var i = 0; i < values.length; i++) s[values[i]] = true;
    return s;
  }

  function buildSchedule(ast) {
    return {
      minute: toSet(ast.minute),
      hour: toSet(ast.hour),
      dom: toSet(ast.dom),
      month: toSet(ast.month),
      dow: toSet(ast.dow),
      domRestricted: ast.domRestricted,
      dowRestricted: ast.dowRestricted,
      raw: ast.raw
    };
  }

  function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

  function daysInMonth(year, month) {
    if (month === 2) return isLeapYear(year) ? 29 : 28;
    if (month === 4 || month === 6 || month === 9 || month === 11) return 30;
    return 31;
  }

  // Sakamoto：返回 0（周日）到 6（周六）
  function dayOfWeek(year, month, day) {
    var t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    var y = year;
    if (month < 3) y -= 1;
    return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[month - 1] + day) % 7;
  }

  var api = {
    buildSchedule: buildSchedule,
    isLeapYear: isLeapYear,
    daysInMonth: daysInMonth,
    dayOfWeek: dayOfWeek,
    toSet: toSet
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.CronFields = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
