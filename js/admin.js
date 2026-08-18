/* Motoworx Winton — stock manager.
   Supabase auth + REST + storage, no SDK. Staff sign in, everything else is
   blocked by row level security. */
(function () {
  'use strict';

  var CFG = window.MOTOWORX;
  var URL_BASE = CFG.supabaseUrl;
  var KEY = CFG.supabaseKey;
  var LS = 'mw-session';

  var session = null;
  try { session = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) {}

  var $ = function (id) { return document.getElementById(id); };
  var authView = $('authView'), appView = $('appView');

  function headers(json) {
    var h = { apikey: KEY, Authorization: 'Bearer ' + (session ? session.access_token : KEY) };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  var toastTimer;
  function toast(msg, bad) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.toggle('toast--bad', !!bad);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var money = function (n) {
    return (n === null || n === undefined || n === '') ? 'No price'
      : '$' + Number(n).toLocaleString('en-NZ', { maximumFractionDigits: 0 });
  };

  /* ---------- auth ---------- */
  function showApp() {
    authView.hidden = true;
    appView.hidden = false;
    $('signOut').hidden = false;
    $('who').textContent = session && session.user ? session.user.email : '';
    loadBikes();
    loadEnquiries();
  }
  function showAuth() {
    authView.hidden = false;
    appView.hidden = true;
    $('signOut').hidden = true;
    $('who').textContent = '';
  }

  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('loginBtn'), err = $('loginErr');
    err.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Signing in';

    fetch(URL_BASE + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('loginEmail').value.trim(), password: $('loginPass').value })
    }).then(function (r) { return r.json().then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.body.error_description || res.body.msg || 'Could not sign in');
        session = res.body;
        localStorage.setItem(LS, JSON.stringify(session));
        showApp();
      })
      .catch(function (e2) { err.textContent = e2.message + '. Check the email and password and try again.'; })
      .then(function () { btn.disabled = false; btn.textContent = 'Sign in'; });
  });

  $('signOut').addEventListener('click', function () {
    localStorage.removeItem(LS);
    session = null;
    showAuth();
  });

  /* ---------- tabs ---------- */
  document.querySelectorAll('[data-tab]').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.getAttribute('data-tab');
      document.querySelectorAll('[data-tab]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      $('tabStock').hidden = t !== 'stock';
      $('tabEnquiries').hidden = t !== 'enquiries';
    });
  });

  /* ---------- photo picker ---------- */
  var pickedFile = null;
  $('drop').addEventListener('click', function () { $('photo').click(); });
  $('photo').addEventListener('change', function () {
    pickedFile = this.files && this.files[0] ? this.files[0] : null;
    if (!pickedFile) return;
    var reader = new FileReader();
    reader.onload = function (ev) {
      $('dropPreview').innerHTML = '<img src="' + ev.target.result + '" alt="Selected photo preview">';
      $('dropText').textContent = pickedFile.name + ' — tap to choose a different one';
    };
    reader.readAsDataURL(pickedFile);
  });

  function uploadPhoto(file) {
    var clean = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
    var path = Date.now() + '-' + clean;
    return fetch(URL_BASE + '/storage/v1/object/bike-photos/' + encodeURIComponent(path), {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': file.type || 'image/jpeg' }, headers()),
      body: file
    }).then(function (r) {
      if (!r.ok) throw new Error('Photo upload failed');
      return URL_BASE + '/storage/v1/object/public/bike-photos/' + encodeURIComponent(path);
    });
  }

  /* ---------- bikes ---------- */
  var bikes = [];

  function loadBikes() {
    fetch(URL_BASE + '/rest/v1/bikes?select=*&order=sort_order.desc,created_at.desc', { headers: headers() })
      .then(function (r) { return r.json(); })
      .then(function (rows) { bikes = rows || []; renderBikes(); })
      .catch(function () { toast('Could not load the stock list', true); });
  }

  function renderBikes() {
    var host = $('adminList');
    $('stockCount').textContent = bikes.length ? '(' + bikes.length + ')' : '';
    if (!bikes.length) {
      host.innerHTML = '<div class="state"><h3>No bikes yet</h3><p>Add the first one above and it appears on the website straight away.</p></div>';
      return;
    }
    host.innerHTML = bikes.map(function (b) {
      var title = [b.year, b.make, b.model].filter(Boolean).join(' ');
      var bits = [money(b.price_nzd), b.condition === 'used' ? 'Used' : 'New'];
      if (b.category) bits.push(b.category);
      if (b.sold) bits.push('SOLD');
      return '' +
        '<div class="aitem" data-id="' + b.id + '">' +
          (b.image_url ? '<img src="' + esc(b.image_url) + '" alt="">' : '<div class="noimg">No<br>photo</div>') +
          '<div><h4>' + esc(title) + '</h4><div class="meta">' + esc(bits.join(' · ')) + '</div></div>' +
          '<div class="acts">' +
            '<button class="mini ' + (b.sold ? 'mini--on' : '') + '" data-act="sold">' + (b.sold ? 'Mark available' : 'Mark sold') + '</button>' +
            '<button class="mini" data-act="edit">Edit</button>' +
            '<button class="mini mini--danger" data-act="del">Delete</button>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  $('adminList').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var id = btn.closest('.aitem').getAttribute('data-id');
    var bike = bikes.filter(function (b) { return b.id === id; })[0];
    if (!bike) return;
    var act = btn.getAttribute('data-act');

    if (act === 'sold') {
      patch(id, { sold: !bike.sold }).then(function () {
        toast(bike.sold ? 'Back on the website' : 'Marked as sold');
        loadBikes();
      });
    }

    if (act === 'del') {
      if (!confirm('Delete ' + [bike.year, bike.make, bike.model].filter(Boolean).join(' ') + ' from the website? This cannot be undone.')) return;
      fetch(URL_BASE + '/rest/v1/bikes?id=eq.' + id, { method: 'DELETE', headers: headers() })
        .then(function (r) {
          if (!r.ok) throw new Error();
          toast('Deleted');
          loadBikes();
        }).catch(function () { toast('Could not delete that one', true); });
    }

    if (act === 'edit') {
      $('bikeId').value = bike.id;
      $('make').value = ['Kawasaki', 'CFMOTO'].indexOf(bike.make) > -1 ? bike.make : 'Other';
      $('model').value = bike.model || '';
      $('year').value = bike.year || '';
      $('price').value = bike.price_nzd || '';
      $('odo').value = bike.odometer_km || '';
      $('cond').value = bike.condition || 'new';
      $('cat').value = bike.category || '';
      $('sort').value = String(bike.sort_order || 0);
      $('blurb').value = bike.blurb || '';
      $('formTitle').textContent = 'Edit bike';
      $('saveBtn').textContent = 'Save changes';
      $('cancelEdit').hidden = false;
      $('dropPreview').innerHTML = bike.image_url ? '<img src="' + esc(bike.image_url) + '" alt="">' : '';
      $('dropText').textContent = bike.image_url ? 'Tap to replace the photo' : 'Tap to choose a photo';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  function patch(id, body) {
    return fetch(URL_BASE + '/rest/v1/bikes?id=eq.' + id, {
      method: 'PATCH', headers: Object.assign({ Prefer: 'return=minimal' }, headers(true)), body: JSON.stringify(body)
    }).then(function (r) { if (!r.ok) throw new Error(); });
  }

  function resetForm() {
    $('bikeForm').reset();
    $('bikeId').value = '';
    pickedFile = null;
    $('dropPreview').innerHTML = '';
    $('dropText').textContent = 'Tap to choose a photo, or take one on your phone';
    $('formTitle').textContent = 'Add a bike';
    $('saveBtn').textContent = 'Add bike';
    $('cancelEdit').hidden = true;
    $('bikeErr').textContent = '';
  }
  $('cancelEdit').addEventListener('click', resetForm);

  $('bikeForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var err = $('bikeErr');
    err.textContent = '';
    if (!$('model').value.trim()) { err.textContent = 'Give it a model name so customers know what it is.'; $('model').focus(); return; }

    var btn = $('saveBtn'), label = btn.textContent;
    btn.disabled = true;
    btn.textContent = pickedFile ? 'Uploading photo' : 'Saving';

    var num = function (v) { return v === '' || v === null ? null : Number(v); };
    var row = {
      make: $('make').value,
      model: $('model').value.trim(),
      year: num($('year').value),
      price_nzd: num($('price').value),
      odometer_km: num($('odo').value),
      condition: $('cond').value,
      category: $('cat').value || null,
      blurb: $('blurb').value.trim() || null,
      sort_order: Number($('sort').value || 0)
    };

    var work = pickedFile ? uploadPhoto(pickedFile).then(function (url) { row.image_url = url; }) : Promise.resolve();

    work.then(function () {
      var id = $('bikeId').value;
      btn.textContent = 'Saving';
      if (id) return patch(id, row);
      return fetch(URL_BASE + '/rest/v1/bikes', {
        method: 'POST', headers: Object.assign({ Prefer: 'return=minimal' }, headers(true)), body: JSON.stringify(row)
      }).then(function (r) { if (!r.ok) throw new Error(); });
    }).then(function () {
      toast($('bikeId').value ? 'Changes saved' : 'Bike added to the website');
      resetForm();
      loadBikes();
    }).catch(function (e2) {
      err.textContent = (e2 && e2.message ? e2.message : 'That did not save') + '. Try again, or check your connection.';
    }).then(function () {
      btn.disabled = false;
      if (btn.textContent === 'Saving' || btn.textContent === 'Uploading photo') btn.textContent = label;
    });
  });

  /* ---------- enquiries ---------- */
  function loadEnquiries() {
    fetch(URL_BASE + '/rest/v1/enquiries?select=*&order=created_at.desc&limit=100', { headers: headers() })
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        rows = rows || [];
        var open = rows.filter(function (r2) { return !r2.handled; }).length;
        $('enqCount').textContent = open ? '(' + open + ')' : '';
        var host = $('enqList');
        if (!rows.length) {
          host.innerHTML = '<div class="state"><h3>No enquiries yet</h3><p>Anything sent through the website forms lands here.</p></div>';
          return;
        }
        host.innerHTML = rows.map(function (q) {
          var when = new Date(q.created_at).toLocaleString('en-NZ', { dateStyle: 'medium', timeStyle: 'short' });
          return '' +
            '<div class="aitem" data-id="' + q.id + '" style="grid-template-columns:1fr auto;opacity:' + (q.handled ? '.55' : '1') + '">' +
              '<div>' +
                '<h4>' + esc(q.name) + ' · <span style="color:var(--volt)">' + esc(q.department) + '</span></h4>' +
                '<div class="meta">' + esc(when) + ' · ' + esc(q.email) + (q.phone ? ' · ' + esc(q.phone) : '') + (q.bike ? ' · ' + esc(q.bike) : '') + '</div>' +
                '<p style="margin-top:8px;font-size:.96rem">' + esc(q.message) + '</p>' +
              '</div>' +
              '<div class="acts">' +
                '<a class="mini" href="mailto:' + esc(q.email) + '?subject=' + encodeURIComponent('Motoworx Winton') + '">Reply</a>' +
                '<button class="mini ' + (q.handled ? 'mini--on' : '') + '" data-eact="handled">' + (q.handled ? 'Done' : 'Mark done') + '</button>' +
              '</div>' +
            '</div>';
        }).join('');
      })
      .catch(function () { /* tab simply stays empty */ });
  }

  $('enqList').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-eact]');
    if (!btn) return;
    var id = btn.closest('.aitem').getAttribute('data-id');
    var makeDone = btn.textContent.trim() === 'Mark done';
    fetch(URL_BASE + '/rest/v1/enquiries?id=eq.' + id, {
      method: 'PATCH', headers: Object.assign({ Prefer: 'return=minimal' }, headers(true)),
      body: JSON.stringify({ handled: makeDone })
    }).then(function (r) {
      if (!r.ok) throw new Error();
      loadEnquiries();
    }).catch(function () { toast('Could not update that', true); });
  });

  /* ---------- boot ---------- */
  if (session && session.access_token) {
    fetch(URL_BASE + '/auth/v1/user', { headers: headers() })
      .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (u) { session.user = u; showApp(); })
      .catch(function () { localStorage.removeItem(LS); session = null; showAuth(); });
  } else {
    showAuth();
  }
})();
