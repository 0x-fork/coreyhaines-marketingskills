/*! Framer Forms conversion detection (MIT)
 *  Detects: form submission. Pushes dataLayer event: framer_form_submitted
 *  From the conversion-tracking skill in Marketing Skills */
(function () {
  // SUBMIT-BASED BEST EFFORT. Framer cancels the native submit and sends
  // the form by script, so a bubble-phase listener always sees it cancelled
  // and never fires. This listens in the capture phase, before Framer's own
  // handler runs, and fires on a submit that passes browser validation. It
  // is still submit-based, so a server-side rejection, a spam block or any
  // later custom validation still counts. A 2-second debounce per form only
  // collapses rapid repeats (a double click). Framer documents a
  // framer:formsubmit event, but it fires only when the form has a tracking
  // ID set and isn't documented as success-only, so this doesn't rely on
  // it. For exact counts, set the form to redirect to a thank-you page and
  // use thank-you-page.js instead.
  if (window.__ctDetectFramerForms) return;
  window.__ctDetectFramerForms = true;
  window.dataLayer = window.dataLayer || [];

  function fireConversion(formName) {
    window.dataLayer.push({
      event: 'framer_form_submitted',
      form_name: formName || ''
    });
  }

  function isFramerForm(formEl) {
    if (!formEl) return false;
    if (formEl.hasAttribute && formEl.hasAttribute('data-framer-name')) return true;
    var cls = typeof formEl.className === 'string' ? formEl.className : '';
    if (/(^|\s)framer-[A-Za-z0-9_-]+/.test(cls)) return true;
    try {
      if (formEl.closest && formEl.closest('[data-framer-component-type]')) return true;
      if (formEl.closest && formEl.closest('[data-framer-name]')) return true;
    } catch (e) {
      // .closest not available — fall through
    }
    return false;
  }

  function handleSubmit(event) {
    try {
      var formEl = event.target;
      if (!formEl || (formEl.tagName || '').toLowerCase() !== 'form') return;
      if (!isFramerForm(formEl)) return;

      // Constraint validation gate: an invalid form cannot have submitted.
      try {
        if (typeof formEl.checkValidity === 'function' && formEl.checkValidity() === false) return;
      } catch (e) {
        // constraint validation unavailable — fall through
      }

      // Collapse rapid repeats on this same form element. Keyed on the
      // element itself, so two forms with the same name, or no name, don't
      // share a timestamp.
      var now = Date.now();
      if (formEl.__ctFramerLastFire && now - formEl.__ctFramerLastFire < 2000) return;
      formEl.__ctFramerLastFire = now;

      var formName = formEl.getAttribute('data-framer-name') || formEl.id || '';

      fireConversion(formName);
    } catch (e) {
      // Never throw back into Framer's own form handling.
    }
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    // Capture phase, so this runs before Framer's own handler cancels the
    // native submit.
    document.addEventListener('submit', handleSubmit, true);
  }
})();
