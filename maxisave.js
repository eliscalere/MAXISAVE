/* Maxisave — by Scalere Design
 *
 * Keeps a draft of a Maxient report in this browser's localStorage (it never
 * leaves the machine), restores it on reload, and deletes it once the form is
 * submitted. Attachments are opt-in and stored in IndexedDB.
 *
 * Not affiliated with or endorsed by Maxient LLC.
 */
(function () {
  'use strict';

  var FORM = document.getElementById('IR') || document.forms[0];
  if (!FORM) return;

  // ---------------------------------------------------------------- config
  var SAVE_DELAY = 700;          // ms of idle typing before a save
  var BACKSTOP_INTERVAL = 20000; // ms, periodic flush in case an event slips by
  var SUBMIT_GRACE = 6000;       // ms to wait before deciding a submit was blocked
  var MAX_AGE_DAYS = 14;         // drafts older than this are discarded on load
  var MAX_ROW_CLICKS = 40;       // safety cap when adding/removing party rows
  var ROW_ANIM = 220;            // ms; removing a row is animated and ignores clicks
  var ROW_SETTLE = 120;          // ms to let an added row settle before the next
  var RESTORE_DEADLINE = 20000;  // ms; give up re-trying the restore after this

  // Never persisted: session tokens, uploads, and the browser's own buttons.
  var SKIP_TYPES = {
    hidden: 1, file: 1, password: 1, submit: 1, button: 1, reset: 1, image: 1
  };

  function q(name) {
    var el = FORM.querySelector('input[name="' + name + '"]');
    return el ? el.value : '';
  }
  var params = new URLSearchParams(location.search);
  var institution = q('institution') || (location.search.replace('?', '').split('&')[0] || 'unknown');
  var layout = q('layout_id') || params.get('layout_id') || '0';
  var KEY = 'maxient-autosave:' + institution + ':' + layout;
  var PENDING_KEY = KEY + ':pending';
  var OPTIN_KEY = KEY + ':files';

  var DB_NAME = 'maxient-autosave';
  var STORE = 'attachments';
  var KEY_PREFIX = 'maxient-autosave:';

  var draft = null;        // the draft currently being restored, if any
  var ready = false;       // gates all writes
  var userTouched = false; // a real (trusted) edit has happened
  var submitted = false;
  var unloading = false;
  var saveTimer = null;
  var restoreTimer = null;
  var restoreStart = 0;
  var filesOptIn = false;   // attachments are only kept if the user opts in

  // --------------------------------------------------------------- storage
  function read(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.fields) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function write(key, payload) {
    try {
      localStorage.setItem(key, JSON.stringify(payload));
      return true;
    } catch (e) {
      return false;
    }
  }

  function drop(key) {
    try { localStorage.removeItem(key); } catch (e) { /* nothing to do */ }
  }

  // ------------------------------------------------------------ collecting
  // Fields are keyed by name + occurrence index, so repeated names such as
  // person[] and radio groups such as aq[2][answer] round-trip correctly.
  function eachField(fn) {
    var counts = Object.create(null);
    var els = FORM.elements;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el.name || SKIP_TYPES[(el.type || '').toLowerCase()]) continue;
      var n = counts[el.name] = (counts[el.name] === undefined ? 0 : counts[el.name] + 1);
      fn(el, el.name + '#' + n);
    }
  }

  function collect() {
    var fields = Object.create(null);
    eachField(function (el, key) {
      var type = (el.type || '').toLowerCase();
      if (type === 'checkbox' || type === 'radio') {
        fields[key] = el.checked ? 1 : 0;
      } else if (el.tagName === 'SELECT' && el.multiple) {
        fields[key] = Array.prototype.map.call(el.selectedOptions, function (o) { return o.value; });
      } else {
        fields[key] = el.value;
      }
    });
    return fields;
  }

  function isEmpty(fields) {
    for (var k in fields) {
      var v = fields[k];
      if (Array.isArray(v) ? v.length : (v !== '' && v !== 0)) return false;
    }
    return true;
  }

  // ---------------------------------------------------------- party rows
  function domRows() {
    return FORM.querySelectorAll('[name="person[]"]').length;
  }

  function draftRows() {
    if (!draft) return 0;
    var n = 0;
    for (var k in draft.fields) if (k.indexOf('person[]#') === 0) n++;
    return n;
  }

  // The page fades a newly added row in with jQuery, which drives its
  // animations off requestAnimationFrame. In a background tab — or one still
  // loading — rAF never fires, so the fade is started and abandoned and the row
  // is left fully laid out at opacity 0: present, focusable, submitted with the
  // form, but invisible. Nothing ever finishes it, so clear the leftovers.
  function normalizeRows() {
    var rows = document.querySelectorAll('.personrow');
    for (var i = 0; i < rows.length; i++) {
      var s = rows[i].style;
      if (s.opacity !== '' && parseFloat(s.opacity) < 1) s.opacity = '';
      if (s.display === 'none') s.display = '';
      // Same story for a stalled slide (the signature is a pinned height with
      // overflow hidden).
      if (s.height && s.overflow === 'hidden') {
        s.height = '';
        s.overflow = '';
      }
    }
  }

  // Removing a row is animated, and clicks during the animation are ignored,
  // so this steps through one at a time instead of clicking in a tight loop.
  function resetRows(done) {
    var btnDel = document.getElementById('btnDel');
    var guard = 0;
    var stalled = 0;

    (function step() {
      if (!btnDel || domRows() <= 1 || guard++ >= MAX_ROW_CLICKS || stalled >= 3) {
        done();
        return;
      }
      var before = domRows();
      btnDel.click();
      setTimeout(function () {
        stalled = domRows() === before ? stalled + 1 : 0;
        step();
      }, ROW_ANIM);
    })();
  }

  // -------------------------------------------------------- parties panel
  // A live-updating summary of the Involved Parties rows, so you can see who's
  // already listed while scrolling down to write the narrative — without
  // physically moving Maxient's own section (different layouts and
  // institutions share this template, per #involvedPersons below, but not
  // necessarily its surrounding column structure, so repositioning it with
  // CSS floats risks breaking a form this was never tested against; a
  // separate panel that only reads data carries none of that risk).
  //
  // #involvedPersons is the element Maxient's OWN clone-form script targets to
  // add/remove rows, so unlike a numbered section id (#section3, which shifts
  // depending on how many sections precede it on a given layout) it is a
  // stable anchor across different institutions and report types — confirmed
  // identical on two unrelated Maxient forms.
  function partiesAnchor() {
    return document.getElementById('involvedPersons');
  }

  function partyRoleLabel(row) {
    var sel = row.querySelector('[name="role[]"]');
    if (!sel || sel.selectedIndex < 0) return '';
    var opt = sel.options[sel.selectedIndex];
    return opt ? opt.textContent.trim() : '';
  }

  function partyRows() {
    var anchor = partiesAnchor();
    if (!anchor) return [];
    return Array.prototype.slice.call(anchor.querySelectorAll('.personrow'));
  }

  function updatePartiesPanel() {
    if (!ui.partiesPanel) return;
    var rows = partyRows();
    var entries = [];
    for (var i = 0; i < rows.length; i++) {
      var nameEl = rows[i].querySelector('[name="person[]"]');
      var name = nameEl ? nameEl.value.trim() : '';
      if (!name) continue;
      entries.push({ row: rows[i], name: name, role: partyRoleLabel(rows[i]) });
    }

    if (!entries.length) {
      ui.partiesPanel.hidden = true;
      return;
    }

    ui.partiesPanel.hidden = false;
    ui.partiesList.innerHTML = '';
    for (var j = 0; j < entries.length; j++) {
      (function (entry, index) {
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'mxa-party';
        item.innerHTML =
          '<span class="mxa-party-num">' + (index + 1) + '</span>' +
          '<span class="mxa-party-name"></span>' +
          (entry.role ? '<span class="mxa-party-role"></span>' : '');
        item.querySelector('.mxa-party-name').textContent = entry.name;
        if (entry.role) item.querySelector('.mxa-party-role').textContent = entry.role;
        item.addEventListener('click', function () {
          entry.row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          entry.row.classList.add('mxa-flash');
          setTimeout(function () { entry.row.classList.remove('mxa-flash'); }, 900);
        });
        ui.partiesList.appendChild(item);
      })(entries[j], j);
    }
  }

  // -------------------------------------------------- textarea readability
  // Maxient's long-form narrative questions render as a 5-row textarea by
  // default, cramped for the multi-paragraph incident descriptions this form
  // asks for. Enhancing every textarea found is layout-agnostic by
  // construction: it doesn't depend on which section a given question lives
  // in or how many there are, only that it's a textarea.
  function enhanceTextareas() {
    var areas = FORM.querySelectorAll('textarea');
    for (var i = 0; i < areas.length; i++) {
      areas[i].classList.add('mxa-textarea');
    }
  }

  // ------------------------------------------------------------- restoring
  function hasOption(select, value) {
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].value === value) return true;
    }
    return false;
  }

  function fire(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // onlyEmpty: later passes only fill fields still blank, so a retry can never
  // overwrite something the page or the user has since put there.
  function applyDraft(onlyEmpty) {
    var fields = draft.fields;
    var filled = 0;

    eachField(function (el, key) {
      if (!(key in fields)) return;
      var value = fields[key];
      var type = (el.type || '').toLowerCase();

      if (type === 'checkbox' || type === 'radio') {
        if (!value || el.checked) return;
        el.checked = true;
        filled++;
      } else if (el.tagName === 'SELECT' && el.multiple) {
        var wanted = Array.isArray(value) ? value : [];
        if (!wanted.length || (onlyEmpty && el.selectedOptions.length)) return;
        Array.prototype.forEach.call(el.options, function (o) { o.selected = wanted.indexOf(o.value) > -1; });
        filled++;
      } else {
        if (value === '' || el.value === value) return;
        if (onlyEmpty && el.value !== '') return;
        if (el.tagName === 'SELECT' && !hasOption(el, value)) return;
        el.value = value;
        filled++;
      }
      fire(el);
    });

    return filled;
  }

  // How much of the draft is still not on screen.
  function outstanding() {
    if (!draft) return 0;
    var fields = draft.fields;
    var missing = Math.max(0, draftRows() - domRows());

    eachField(function (el, key) {
      if (!(key in fields)) return;
      var value = fields[key];
      var type = (el.type || '').toLowerCase();
      if (type === 'checkbox' || type === 'radio') {
        if (value && !el.checked) missing++;
      } else if (el.tagName === 'SELECT' && el.multiple) {
        if (Array.isArray(value) && value.length && !el.selectedOptions.length) missing++;
      } else if (value !== '' && el.value !== value) {
        if (el.tagName !== 'SELECT' || hasOption(el, value)) missing++;
      }
    });

    return missing;
  }

  // Rows are added one per tick rather than in a tight loop: the page clones the
  // last row, so cloning while a fade is still in flight copies its half-faded
  // inline styles onto the new row.
  function restoreTick(pass) {
    if (!draft || userTouched) return;

    applyDraft(pass > 0);
    normalizeRows();

    if (outstanding() === 0 || Date.now() - restoreStart > RESTORE_DEADLINE) {
      finishRestore();
      return;
    }

    var wait;
    if (domRows() < draftRows()) {
      var before = domRows();
      var btnAdd = document.getElementById('btnAdd');
      if (btnAdd) btnAdd.click();
      normalizeRows();
      // A click that added nothing means the page's clone script isn't wired up
      // yet (or we hit its row cap) — back off and try again.
      wait = domRows() === before ? 400 : ROW_SETTLE;
    } else {
      wait = Math.min(150 * (pass + 1), 1200);
    }

    restoreTimer = setTimeout(function () { restoreTick(pass + 1); }, wait);
  }

  function finishRestore() {
    normalizeRows();
    enhanceTextareas();
    updatePartiesPanel();
    setStatus('restored', 'Draft restored from ' + timeLabel(draft.savedAt));
  }

  // ---------------------------------------------------------------- saving
  function saveNow() {
    if (!ready || submitted) return;

    // A restore that hasn't finished must never be written back — otherwise one
    // slow load truncates a five-party draft to one party, permanently.
    if (!userTouched && draft && domRows() < draftRows()) {
      setStatus('restoring');
      return;
    }

    var fields = collect();
    // Don't create a draft just because someone opened the page, but do allow
    // an existing draft to be overwritten with an emptied form.
    if (isEmpty(fields) && !localStorage.getItem(KEY)) return;

    var ok = write(KEY, { savedAt: Date.now(), version: 1, fields: fields });
    setStatus(ok ? 'saved' : 'error');
    if (ok) renderSwitcher();
  }

  function scheduleSave() {
    if (!ready || submitted) return;
    setStatus('saving');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, SAVE_DELAY);
  }

  // Once the user edits anything for real, stop trying to restore and let their
  // version of the form win.
  function markTouched() {
    if (userTouched) return;
    userTouched = true;
    clearTimeout(restoreTimer);
  }

  // Restore fires synthetic input/change events to populate the form (see
  // applyDraft). Those must not schedule a save — the values are already in
  // storage, and reacting to them cuts the "Draft restored" message short by
  // immediately overwriting it with "Saved". Only a real, trusted edit should
  // count.
  function onUserEvent(e) {
    if (!e || !e.isTrusted) return;
    markTouched();
    scheduleSave();
    updatePartiesPanel();
  }

  // ------------------------------------------------------------------- UI
  var ui = {};

  function buildUI() {
    var root = document.createElement('div');
    root.className = 'mxa-root';
    root.innerHTML =
      '<div class="mxa-notice" hidden>' +
        '<span class="mxa-notice-text"></span>' +
        '<button type="button" class="mxa-notice-btn"></button>' +
      '</div>' +
      '<div class="mxa-switcher-panel" hidden>' +
        '<div class="mxa-switcher-head">Saved drafts</div>' +
        '<div class="mxa-switcher-list"></div>' +
      '</div>' +
      '<div class="mxa-bar">' +
        '<div class="mxa-pill" role="status" aria-live="polite">' +
          '<span class="mxa-dot"></span><span class="mxa-label">Autosave on</span>' +
        '</div>' +
        '<button type="button" class="mxa-switcher-toggle" title="See drafts saved for other forms">' +
          'Saved <span class="mxa-switcher-count">0</span>' +
        '</button>' +
        '<button type="button" class="mxa-clear" title="Delete the saved draft and empty the form">Clear</button>' +
      '</div>';
    document.body.appendChild(root);

    ui.root = root;
    ui.pill = root.querySelector('.mxa-pill');
    ui.label = root.querySelector('.mxa-label');
    ui.clear = root.querySelector('.mxa-clear');
    ui.notice = root.querySelector('.mxa-notice');
    ui.noticeText = root.querySelector('.mxa-notice-text');
    ui.noticeBtn = root.querySelector('.mxa-notice-btn');
    ui.switcherToggle = root.querySelector('.mxa-switcher-toggle');
    ui.switcherCount = root.querySelector('.mxa-switcher-count');
    ui.switcherPanel = root.querySelector('.mxa-switcher-panel');
    ui.switcherList = root.querySelector('.mxa-switcher-list');
    ui.clear.addEventListener('click', clearDraft);
    ui.noticeBtn.addEventListener('click', toggleAttachments);
    ui.switcherToggle.addEventListener('click', toggleSwitcher);

    var panel = document.createElement('div');
    panel.className = 'mxa-parties';
    panel.hidden = true;
    panel.innerHTML =
      '<div class="mxa-parties-head">Involved Parties</div>' +
      '<div class="mxa-parties-list"></div>';
    document.body.appendChild(panel);
    ui.partiesPanel = panel;
    ui.partiesList = panel.querySelector('.mxa-parties-list');
  }

  var stateTimer = null;
  function setStatus(state, text) {
    if (!ui.pill) return;
    clearTimeout(stateTimer);
    ui.pill.dataset.state = state;
    ui.label.textContent = text || {
      saving: 'Saving…',
      saved: 'Saved ' + timeLabel(Date.now()),
      restoring: 'Restoring draft…',
      restored: 'Draft restored',
      clearing: 'Clearing…',
      cleared: 'Draft cleared',
      idle: 'Autosave on',
      error: 'Could not save'
    }[state];

    if (state === 'restored' || state === 'cleared') {
      stateTimer = setTimeout(function () { setStatus('idle'); }, 6000);
    }
  }

  function timeLabel(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function clearDraft() {
    if (!window.confirm('Delete the saved draft and empty this form?\n\nThis cannot be undone.')) return;

    drop(KEY);
    drop(PENDING_KEY);
    drop(OPTIN_KEY);
    clearAttachmentStore();
    filesOptIn = false;
    draft = null;
    ready = false;               // keep autosave quiet while the form is torn down
    clearTimeout(saveTimer);
    clearTimeout(restoreTimer);
    setStatus('clearing');

    clearFields();
    resetRows(function () {
      clearFields();             // clear the one row that's left
      repairChoiceValues();
      clearValidationState();
      normalizeRows();
      updateAttachmentNotice();
      updatePartiesPanel();
      renderSwitcher();
      userTouched = false;
      ready = true;
      setStatus('cleared');
    });
  }

  // The upload widget renders its own list of its own accord.
  function clearAttachments() {
    var items = document.querySelectorAll('.jFiler-items li, .jFiler-item');
    for (var i = 0; i < items.length; i++) items[i].remove();
    var files = FORM.querySelectorAll('input[type="file"]');
    for (var j = 0; j < files.length; j++) {
      try { files[j].value = ''; } catch (e) { /* nothing to do */ }
    }
  }

  // NEVER call form.reset() on this page. It is a Foundation Abide form, and
  // Abide hooks the native reset event to run resetForm(), which does .val('')
  // across every input — including radios and checkboxes, whose value attribute
  // it wipes permanently. After that the group can never satisfy Abide's
  // requiredCheck (it tests .val().length), so the question stays red until a
  // refresh re-fetches the markup, and worse, the answer would submit blank.
  function clearFields() {
    eachField(function (el) {
      var type = (el.type || '').toLowerCase();
      if (type === 'checkbox' || type === 'radio') {
        el.checked = el.defaultChecked;          // leave .value alone
      } else if (el.tagName === 'SELECT') {
        var opts = el.options;
        for (var i = 0; i < opts.length; i++) opts[i].selected = opts[i].defaultSelected;
        if (el.selectedIndex === -1 && opts.length) el.selectedIndex = 0;
      } else {
        el.value = el.defaultValue;
      }
    });
    clearAttachments();
  }

  // Abide's error styling has to come off by hand now that we don't reset.
  function clearValidationState() {
    var marked = FORM.querySelectorAll('.is-invalid-input, .is-invalid-label, .form-error.is-visible');
    for (var i = 0; i < marked.length; i++) {
      marked[i].classList.remove('is-invalid-input', 'is-invalid-label', 'is-visible');
    }
  }

  // Belt and braces: remember the choice values as the server sent them, and
  // put any back that get blanked — the page has its own reset paths that hit
  // the same Abide bug.
  var choiceValues = null;

  function snapshotChoiceValues() {
    choiceValues = [];
    var els = FORM.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    for (var i = 0; i < els.length; i++) {
      if (els[i].value !== '') choiceValues.push({ el: els[i], value: els[i].value });
    }
  }

  function repairChoiceValues() {
    if (!choiceValues) return;
    for (var i = 0; i < choiceValues.length; i++) {
      var c = choiceValues[i];
      if (c.el.isConnected && c.el.value === '') c.el.value = c.value;
    }
  }

  // ------------------------------------------------------------ attachments
  // Attachments are off by default: they're photos and documents about named
  // students, and persisting them puts real files in browser storage. When the
  // user opts in they go to IndexedDB, which takes Blobs directly — localStorage
  // is strings only and capped at 5MB.
  //
  // Restoring works because input.files can be assigned from a DataTransfer, and
  // dispatching change afterwards makes the page's uploader render what is
  // actually staged. Verified on this form: FormData then carries the restored
  // file, so what's shown is what would upload.
  function fileInput() {
    return FORM.querySelector('input[type="file"]');
  }

  function stagedCount() {
    var input = fileInput();
    return input ? input.files.length : 0;
  }

  function withStore(mode, fn) {
    if (typeof indexedDB === 'undefined') return;
    var req;
    try { req = indexedDB.open(DB_NAME, 1); } catch (e) { return; }
    req.onupgradeneeded = function () {
      var db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = function () {
      try { fn(req.result.transaction(STORE, mode).objectStore(STORE)); } catch (e) { /* nothing to do */ }
    };
  }

  function saveAttachments() {
    var input = fileInput();
    if (!input) return;
    var files = Array.prototype.slice.call(input.files);
    withStore('readwrite', function (store) {
      if (files.length) store.put({ savedAt: Date.now(), files: files }, KEY);
      else store.delete(KEY);
    });
  }

  function clearAttachmentStore() {
    withStore('readwrite', function (store) { store.delete(KEY); });
  }

  function restoreAttachments() {
    var input = fileInput();
    if (!input) return;
    withStore('readonly', function (store) {
      var get = store.get(KEY);
      get.onsuccess = function () {
        var rec = get.result;
        if (!rec || !rec.files || !rec.files.length) return;
        if (Date.now() - (rec.savedAt || 0) > MAX_AGE_DAYS * 864e5) {
          clearAttachmentStore();
          return;
        }
        try {
          var dt = new DataTransfer();
          for (var i = 0; i < rec.files.length; i++) dt.items.add(rec.files[i]);
          input.files = dt.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          updateAttachmentNotice();
        } catch (e) { /* nothing to do */ }
      };
    });
  }

  function toggleAttachments() {
    filesOptIn = !filesOptIn;
    try { localStorage.setItem(OPTIN_KEY, filesOptIn ? '1' : ''); } catch (e) { /* nothing to do */ }
    if (filesOptIn) saveAttachments(); else clearAttachmentStore();
    updateAttachmentNotice();
  }

  function updateAttachmentNotice() {
    if (!ui.notice) return;
    var n = stagedCount();
    if (!n) {
      ui.notice.hidden = true;
      return;
    }
    var noun = n === 1 ? 'attachment' : 'attachments';
    ui.notice.hidden = false;
    ui.notice.dataset.state = filesOptIn ? 'on' : 'off';
    ui.noticeText.textContent = filesOptIn
      ? n + ' ' + noun + ' saved with your draft.'
      : n + ' ' + noun + " won't be saved — you'd need to re-attach after a refresh.";
    ui.noticeBtn.textContent = filesOptIn ? 'Stop saving' : 'Save them too';
  }

  // -------------------------------------------------------------- switcher
  // Every institution+layout combination already saves to its own key (see
  // KEY above) — this just makes that visible. A key is a real draft only
  // when it has exactly three ':'-separated parts; ':pending' and ':files'
  // suffixes add a fourth.
  function listDrafts() {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k || k.indexOf(KEY_PREFIX) !== 0) continue;
      var parts = k.split(':');
      if (parts.length !== 3) continue;
      var d = read(k);
      if (!d) continue;
      out.push({ key: k, institution: parts[1], layout: parts[2], savedAt: d.savedAt || 0, isCurrent: k === KEY });
    }
    out.sort(function (a, b) { return b.savedAt - a.savedAt; });
    return out;
  }

  function dateLabel(ts) {
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + timeLabel(ts);
  }

  function renderSwitcher() {
    if (!ui.switcherList) return;
    var drafts = listDrafts();
    ui.switcherCount.textContent = String(drafts.length);
    ui.switcherList.innerHTML = '';

    if (!drafts.length) {
      var empty = document.createElement('div');
      empty.className = 'mxa-switcher-empty';
      empty.textContent = 'No saved drafts yet.';
      ui.switcherList.appendChild(empty);
      return;
    }

    for (var i = 0; i < drafts.length; i++) {
      (function (d) {
        var row = document.createElement('div');
        row.className = 'mxa-switcher-row';
        if (d.isCurrent) row.classList.add('mxa-switcher-current');

        var info = document.createElement('div');
        info.className = 'mxa-switcher-info';
        var top = document.createElement('div');
        top.className = 'mxa-switcher-inst';
        top.textContent = d.institution + ' · layout ' + d.layout + (d.isCurrent ? ' (this page)' : '');
        var bottom = document.createElement('div');
        bottom.className = 'mxa-switcher-time';
        bottom.textContent = 'Saved ' + dateLabel(d.savedAt);
        info.appendChild(top);
        info.appendChild(bottom);

        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'mxa-switcher-del';
        del.title = 'Delete this draft';
        del.textContent = '×';
        del.addEventListener('click', function () {
          if (!window.confirm('Delete the saved draft for ' + d.institution + ' (layout ' + d.layout + ')?')) return;
          drop(d.key);
          drop(d.key + ':pending');
          drop(d.key + ':files');
          if (d.isCurrent) {
            draft = null;
            updateAttachmentNotice();
          }
          renderSwitcher();
        });

        row.appendChild(info);
        row.appendChild(del);
        ui.switcherList.appendChild(row);
      })(drafts[i]);
    }
  }

  function toggleSwitcher() {
    var open = ui.switcherPanel.hidden;
    ui.switcherPanel.hidden = !open;
    if (open) renderSwitcher();
  }

  // -------------------------------------------------------------- lifecycle
  function init() {
    buildUI();
    snapshotChoiceValues();   // before anything can blank them
    enhanceTextareas();
    updatePartiesPanel();
    renderSwitcher();

    // A draft parked by a previous submit means that submit went through
    // (or the user navigated away) — this is a fresh form, so let it go.
    drop(PENDING_KEY);

    draft = read(KEY);
    if (draft && Date.now() - (draft.savedAt || 0) > MAX_AGE_DAYS * 864e5) {
      drop(KEY);
      draft = null;
    }

    // Listen before restoring, so typing during a slow restore stops it.
    FORM.addEventListener('input', onUserEvent, true);
    FORM.addEventListener('change', onUserEvent, true);
    FORM.addEventListener('click', function (e) {
      if (!e.isTrusted) return;
      markTouched();
      // Adding or removing a row by hand hits the same stalled-animation bug,
      // so tidy up after the page has had its go.
      var id = e.target && e.target.id;
      if (id === 'btnAdd' || id === 'btnDel') {
        setTimeout(normalizeRows, 60);
        setTimeout(normalizeRows, 600);
        setTimeout(updatePartiesPanel, 60);
        setTimeout(updatePartiesPanel, 600);
      }
    }, true);

    // Coming back to a backgrounded tab is exactly when abandoned animations
    // surface.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      normalizeRows();
      repairChoiceValues();
    });

    try { filesOptIn = !!localStorage.getItem(OPTIN_KEY); } catch (e) { filesOptIn = false; }

    if (draft) {
      setStatus('restoring');
      restoreStart = Date.now();
      restoreTick(0);
      if (filesOptIn) restoreAttachments();
    } else {
      clearAttachmentStore();   // no draft means nothing to attach files to
    }
    updateAttachmentNotice();

    ready = true;
    setInterval(function () {
      normalizeRows();
      repairChoiceValues();
      saveNow();
      renderSwitcher();
    }, BACKSTOP_INTERVAL);

    // Submit: park the draft, then delete it. If the page is still here after
    // the grace period the submit was blocked (validation, captcha), so the
    // draft comes back rather than being lost.
    FORM.addEventListener('submit', function () {
      submitted = true;
      clearTimeout(saveTimer);
      clearTimeout(restoreTimer);
      var raw = localStorage.getItem(KEY);
      if (raw) {
        try { localStorage.setItem(PENDING_KEY, raw); } catch (e) { /* keep going */ }
        drop(KEY);
      }
      clearAttachmentStore();   // the files are still in the input if this fails
      setStatus('cleared', 'Submitting — draft cleared');
      renderSwitcher();

      setTimeout(function () {
        if (unloading) return;
        var parked = localStorage.getItem(PENDING_KEY);
        if (parked) {
          try { localStorage.setItem(KEY, parked); } catch (e) { /* keep going */ }
          drop(PENDING_KEY);
        }
        if (filesOptIn) saveAttachments();
        submitted = false;
        setStatus('saved');
        renderSwitcher();
      }, SUBMIT_GRACE);
    }, true);

    window.addEventListener('pagehide', function () {
      unloading = true;
      saveNow();
    });

    // Attachments: keep the notice in step, and persist them when opted in.
    var input = fileInput();
    if (input) {
      input.addEventListener('change', function () {
        if (filesOptIn) saveAttachments();
        updateAttachmentNotice();
      });
    }
    // The uploader also removes files through its own controls, which don't
    // always fire change on the input.
    setInterval(updateAttachmentNotice, 1500);

    // Chrome replaces any custom text here with its own generic "Leave site?"
    // dialog, so the explanation lives in the in-page notice above the pill —
    // this only exists to stop the close so that notice gets read.
    window.addEventListener('beforeunload', function (e) {
      if (submitted || filesOptIn || !stagedCount()) return;
      e.preventDefault();
      e.returnValue = '';
    });
  }

  // Start as soon as the form exists rather than waiting on fonts and other
  // page assets; the restore passes cover anything not wired up yet.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
