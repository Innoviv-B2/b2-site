/* B2 theme toggle. theme-init.js (inline in head) has already set data-theme. */
(function () {
  var KEY = "b2-theme", root = document.documentElement;
  var COLORS = { light: "#F4F3F7", dark: "#0F0E13" };
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;

  function stored() { try { var v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : null; } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function current() { return root.getAttribute("data-theme") === "light" ? "light" : "dark"; }

  function apply(t) {
    root.setAttribute("data-theme", t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", COLORS[t]);
    var btns = document.querySelectorAll("[data-theme-toggle]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute("aria-label", t === "light" ? "Switch to dark theme" : "Switch to light theme");
    }
  }

  function toggle() { var t = current() === "light" ? "dark" : "light"; apply(t); save(t); }

  function init() {
    apply(current());
    var btns = document.querySelectorAll("[data-theme-toggle]");
    for (var i = 0; i < btns.length; i++) btns[i].addEventListener("click", toggle);
    if (mq) {
      var onChange = function (e) { if (!stored()) apply(e.matches ? "light" : "dark"); };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  window.B2Theme = { toggle: toggle, get: current };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
