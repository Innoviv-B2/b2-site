/* B2 Motorsports — site behaviour. No dependencies.
   1. Mobile menu + dropdowns (touch-friendly).
   2. Forms: plain HTML forms post to the HubSpot Forms API when a form GUID is configured
      in site.json; otherwise they fall back to a mailto: so nothing is lost.
   3. Review build: window.B2_REVIEW is set and the hash router in review.js takes over links. */
(function () {
  "use strict";
  var cfg = window.B2_CONFIG || {};

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

  /* ---- forms ---- */
  function hsSubmit(form, key) {
    var portal = cfg.hubspot && cfg.hubspot.portalId;
    var guid = cfg.hubspot && cfg.hubspot.forms && cfg.hubspot.forms[key];
    if (!portal || !guid) return Promise.reject(new Error("no-form"));
    var fields = [];
    new FormData(form).forEach(function (v, k) { if (k !== "consent") fields.push({ name: k, value: String(v) }); });
    var consent = form.querySelector("input[name='consent']");
    var body = {
      fields: fields,
      context: { pageUri: location.href, pageName: document.title },
      legalConsentOptions: consent ? { consent: { consentToProcess: true, text: cfg.consentText || "", communications: [{ value: !!consent.checked, subscriptionTypeId: 999, text: cfg.consentText || "" }] } } : undefined
    };
    return fetch("https://api.hsforms.com/submissions/v3/integration/submit/" + portal + "/" + guid, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    }).then(function (r) { if (!r.ok) throw new Error("hs-" + r.status); return r.json(); });
  }

  document.querySelectorAll("form.b2-form").forEach(function (form) {
    var status = form.querySelector(".form__status");
    var key = form.getAttribute("data-form") || "general-inquiry";
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var consent = form.querySelector("input[name='consent']");
      if (consent && !consent.checked) { say("Please tick the consent box so we are allowed to reply.", true); consent.focus(); return; }
      if (window.B2_REVIEW) { say("Review build: submissions are switched off. On the live site this posts to HubSpot form “" + key + "”."); return; }
      say("Sending…");
      hsSubmit(form, key).then(function () {
        form.reset(); say("Thanks. We reply within a business day, by email or text, whichever you gave us.");
      }).catch(function (err) {
        if (err.message === "no-form") {
          // No HubSpot GUID yet: hand off to email so nothing is lost.
          var lines = []; new FormData(form).forEach(function (v, k) { if (k !== "consent") lines.push(k + ": " + v); });
          location.href = "mailto:" + (form.getAttribute("data-email") || cfg.email) + "?subject=" + encodeURIComponent("Website inquiry: " + key) + "&body=" + encodeURIComponent(lines.join("\n"));
          say("Opening your email app with the details filled in.");
        } else {
          say("That did not go through. Call or text " + (cfg.phoneDisplay || "256-910-0658") + " and we will sort it out.", true);
        }
      });
    });
    function say(msg, isErr) { if (!status) return; status.textContent = msg; status.classList.toggle("form__status--error", !!isErr); }
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

  /* ---- footer year ---- */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
