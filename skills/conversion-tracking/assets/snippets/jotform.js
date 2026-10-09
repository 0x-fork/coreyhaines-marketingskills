/*! Jotform conversion detection (MIT)
 *  Detects: form submission. Pushes dataLayer event: jotform_form_submitted
 *  From the conversion-tracking skill in Marketing Skills */
(function () {
  if (window.__ctDetectJotform) return;
  window.__ctDetectJotform = true;
  window.dataLayer = window.dataLayer || [];

  // Two embed styles, two signals of different strength:
  //
  // 1. IFRAME embed (the default Jotform embed code). Jotform doesn't
  //    document any submission message from its embed. In testing a classic
  //    form, nothing reached the host page after submit, and Jotform's own
  //    embed script handles that message only for Card-layout forms. A form
  //    showing an on-page thank-you message wasn't tested. So for iframe
  //    embeds, set the form's thank-you to redirect to a page on this site
  //    and use thank-you-page.js there. Use one method or the other for a
  //    given form, never both. The message listener below is kept only as a
  //    fallback. It fires only for a message from a Jotform iframe on this
  //    page that shows the same form ID, and at most once per form.
  //
  // 2. SOURCE-CODE embed (the form's raw HTML pasted into the page, a
  //    <form class="jotform-form"> posting to submit.jotform.com). Jotform
  //    validates in its own handler, cancels every native submit and then
  //    submits the form itself, so a listener that skips cancelled submits
  //    never fires. This path marks the form on submit (capture phase) and
  //    fires when the browser builds the form's data for the real send (the
  //    formdata event), once per form. In the tested flow (a classic form
  //    with Jotform's own validation on), a submit Jotform rejects builds no
  //    data and doesn't count. A server-side rejection or spam block after
  //    the send still counts.
  //    Known limits. If another script builds the form's data after a
  //    rejected attempt, that counts. Payment, multi-page, save-and-continue
  //    and captcha forms haven't been tested, so prefer the thank-you
  //    redirect plus thank-you-page.js there.

  var JOTFORM_FORM_ID_RE = /^\d{10,}$/;
  var JOTFORM_SUBMIT_ACTION_RE = /^https?:\/\/submit\.jotform\.com\//i;
  var JOTFORM_ORIGIN_RE = /(^|\.)jotform(eu)?\.com$/;

  // Form IDs already counted on this page, shared by both paths.
  var fired = {};

  function fireConversion(formId) {
    window.dataLayer.push({
      event: 'jotform_form_submitted',
      form_id: formId || ''
    });
  }

  // ---- Path 1: iframe embed, message listener kept as a fallback ----

  // True when the iframe's src is a Jotform form host and one of its path
  // segments is exactly this form ID.
  function frameShowsForm(frame, formId) {
    var src = (frame.getAttribute && frame.getAttribute('src')) || '';
    if (!src) return false;
    var url;
    try {
      url = new URL(src, window.location.href);
    } catch (e) {
      return false;
    }
    if (!JOTFORM_ORIGIN_RE.test(url.hostname.toLowerCase())) return false;
    var parts = url.pathname.split('/');
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === formId) return true;
    }
    return false;
  }

  // Frames are looked up when the message arrives, so an iframe inserted
  // after this snippet loaded still binds.
  function sourceIsFormFrame(source, formId) {
    var frames = document.getElementsByTagName('iframe');
    for (var i = 0; i < frames.length; i++) {
      var win = null;
      try { win = frames[i].contentWindow; } catch (e) { win = null; }
      if (win && win === source && frameShowsForm(frames[i], formId)) return true;
    }
    return false;
  }

  function handleMessage(event) {
    try {
      if (!event || !event.source || event.source === window) return;
      if (!event.origin || typeof event.origin !== 'string') return;
      var hostMatch = /^https:\/\/([^/]+)$/.exec(event.origin);
      if (!hostMatch || !JOTFORM_ORIGIN_RE.test(hostMatch[1])) return;

      var data = event.data;
      if (typeof data === 'string') {
        if (data.indexOf('submission-completed') === -1) return;
        try { data = JSON.parse(data); } catch (e) { return; }
      }
      if (!data || typeof data !== 'object') return;
      if (data.action !== 'submission-completed') return;

      var formId = String(data.formID || data.formId || '');
      if (!JOTFORM_FORM_ID_RE.test(formId)) return;
      if (fired[formId]) return;
      if (!sourceIsFormFrame(event.source, formId)) return;

      fireConversion(formId);
      fired[formId] = true;
    } catch (e) {
      // Never throw back into the page's own message handling.
    }
  }

  window.addEventListener('message', handleMessage, false);

  // ---- Path 2: source-code embed, submission built ----

  function isJotformInlineForm(formEl) {
    if (!formEl || (formEl.tagName || '').toLowerCase() !== 'form') return false;
    var hasClass = formEl.classList && formEl.classList.contains('jotform-form');
    var action = formEl.getAttribute && formEl.getAttribute('action');
    var hasAction = action && JOTFORM_SUBMIT_ACTION_RE.test(action);
    if (!hasClass && !hasAction) return false;
    var id = formEl.id || '';
    if (!JOTFORM_FORM_ID_RE.test(id)) return false;
    return true;
  }

  var attempted = {};

  // Capture phase, so this sees the submit before Jotform cancels it.
  document.addEventListener('submit', function (event) {
    var formEl = event.target;
    if (!isJotformInlineForm(formEl)) return;
    attempted[formEl.id] = true;
  }, true);

  // Chromium can raise formdata twice for one submission, so the fired
  // check is what keeps this to one conversion per form. The form is marked
  // fired only after the push succeeds.
  document.addEventListener('formdata', function (event) {
    try {
      var formEl = event.target;
      if (!isJotformInlineForm(formEl)) return;
      if (!attempted[formEl.id] || fired[formEl.id]) return;
      fireConversion(formEl.id);
      fired[formEl.id] = true;
    } catch (e) {
      // Never throw back into Jotform's own submit handling.
    }
  }, true);
})();
