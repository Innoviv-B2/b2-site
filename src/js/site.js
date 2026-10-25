/* B2 Motorsports — site behaviour. No dependencies.
   1. Mobile menu + dropdowns (touch-friendly).
   2. Forms are GoHighLevel embeds (site.json → ghl.forms); a submit becomes a conversion event.
      The footer's "Cookie settings" opens the Zaraz consent dialog.
   3. Review build: window.B2_REVIEW is set and the hash router in review.js takes over links.
   4. Calendar dates that have passed since the last build come off the page. */
(function () {
  "use strict";

  /* ---- header ---- */
  var hdr = document.getElementById("hdr");
  var menuBtn = document.querySelector("[data-menu]");
  if (menuBtn && hdr) {
    menuBtn.addEventListener("click", function () {
      var open = hdr.classList.toggle("hdr--open");
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.textContent = open ? "Close" : "Menu";
    });
  }
  document.querySelectorAll(".nav__item--has-menu .caret").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      var item = btn.closest(".nav__item");
      var open = item.getAttribute("aria-expanded") === "true";
      document.querySelectorAll(".nav__item[aria-expanded='true']").forEach(function (o) { if (o !== item) o.setAttribute("aria-expanded", "false"); });
      item.setAttribute("aria-expanded", String(!open));
      e.preventDefault(); e.stopPropagation();
    });
  });
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".nav__item")) document.querySelectorAll(".nav__item[aria-expanded='true']").forEach(function (o) { o.setAttribute("aria-expanded", "false"); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") document.querySelectorAll(".nav__item[aria-expanded='true']").forEach(function (o) { o.setAttribute("aria-expanded", "false"); });
  });

  /* ---- forms: GoHighLevel embeds ----
     The forms are GoHighLevel iframes, so the page never sees the submit. The iframe posts messages to
     this page; one that reads as a submission becomes a "form_submit" conversion for the tags in Zaraz
     (and dataLayer, if a tag reads it). Which message GoHighLevel sends on submit is confirmed on the
     first test submit (slice 4); the match below is deliberately loose and ignores resize messages. */
  var lastSubmit = {};
  window.addEventListener("message", function (e) {
    if (!/(^|\.)(leadconnectorhq\.com|msgsndr\.com)$/.test((e.origin || "").replace(/^https:\/\//, ""))) return;
    var raw; try { raw = typeof e.data === "string" ? e.data : JSON.stringify(e.data); } catch (x) { return; }
    if (!raw || /height|resize|sticky|scroll/i.test(raw) || !/submit|thank|success/i.test(raw)) return;
    var key = "form";
    document.querySelectorAll("iframe[data-b2-form], iframe[data-form-name]").forEach(function (f) {
      if (f.contentWindow === e.source) key = f.getAttribute("data-b2-form") || f.getAttribute("data-form-name");
    });
    var now = Date.now();
    if (lastSubmit[key] && now - lastSubmit[key] < 5000) return;   // one conversion per submit
    lastSubmit[key] = now;
    var props = { form: key, page: location.pathname };
    try { if (window.zaraz && zaraz.track) zaraz.track("form_submit", props); } catch (x) {}
    (window.dataLayer = window.dataLayer || []).push({ event: "form_submit", form: key, page: location.pathname });
  });

  /* ---- consent: the footer's "Cookie settings" opens Zaraz's consent dialog ---- */
  document.querySelectorAll("[data-consent-settings]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      if (window.zaraz && zaraz.showConsentModal) zaraz.showConsentModal();
    });
  });

  /* ---- YouTube tiles: a link with our own poster until clicked, then the real player ----
     Keeps pages fast and works where frames are blocked (the review build just opens YouTube). */
  document.querySelectorAll("a.yt[data-yt]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      if (window.B2_REVIEW) return;
      e.preventDefault();
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + a.getAttribute("data-yt") + "?autoplay=1";
      f.title = a.getAttribute("aria-label") || "Video";
      f.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
      f.allowFullscreen = true;
      f.referrerPolicy = "strict-origin-when-cross-origin";
      f.className = "yt__frame";
      a.replaceWith(f);
    });
  });

  /* ---- calendar: dates that have passed come off ----
     The build drops past dates, but the site rebuilds only on a push, so the page drops any that have passed
     since. Each row or rail item carries its last day as data-end="YYYY-MM-DD"; one that ends today stays up.
     A rail with data-upcoming-limit shows that many; a data-upcoming-count holds every end date and counts the
     ones still to come; a data-upcoming-empty row shows once nothing is left beside it. */
  var now = new Date(), two = function (n) { return (n < 10 ? "0" : "") + n; };
  var today = now.getFullYear() + "-" + two(now.getMonth() + 1) + "-" + two(now.getDate());
  document.querySelectorAll("[data-end]").forEach(function (el) { if (el.getAttribute("data-end") < today) el.remove(); });
  document.querySelectorAll("[data-upcoming-limit]").forEach(function (list) {
    var n = +list.getAttribute("data-upcoming-limit");
    Array.prototype.forEach.call(list.children, function (li, i) { li.hidden = i >= n; });
  });
  document.querySelectorAll("[data-upcoming-count]").forEach(function (el) {
    el.textContent = el.getAttribute("data-upcoming-count").split(" ").filter(function (d) { return d && d >= today; }).length;
  });
  document.querySelectorAll("[data-upcoming-empty]").forEach(function (el) {
    el.hidden = !!el.parentNode.querySelector("[data-end]");
  });

  /* ---- footer year ---- */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
