/* Motoworx Winton — site behaviour.
   Talks to Supabase over plain REST so there is no SDK to keep up to date. */
(function () {
  'use strict';

  var CFG = window.MOTOWORX || {};
  var REST = CFG.supabaseUrl + '/rest/v1/';
  var HEADERS = { apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- chrome ---------- */
  var nav = document.getElementById('nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('stuck', window.scrollY > 40); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  var burger = document.getElementById('burger');
  var drawer = document.getElementById('drawer');
  if (burger && drawer) {
    burger.addEventListener('click', function () {
      var open = drawer.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(open));
    });
    drawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        drawer.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  /* Gmail compose built at runtime so the address is never literal in the markup */
  document.querySelectorAll('a[data-gmail]').forEach(function (a) {
    var to = a.getAttribute('data-user') + '@' + a.getAttribute('data-domain');
    a.href = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(to) +
      '&su=' + encodeURIComponent('Enquiry for Motoworx Winton');
    a.target = '_blank';
    a.rel = 'noopener';
    if (a.hasAttribute('data-showaddr')) a.textContent = to;
  });

  /* Reveal on scroll */
  var rv = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
    rv.forEach(function (el) { io.observe(el); });
  } else {
    rv.forEach(function (el) { el.classList.add('in'); });
  }


  /* ---------- hero carousel ---------- */
  var slides = document.querySelectorAll('.hero-slide');
  var panels = document.querySelectorAll('.hero-panel');
  var dots = document.querySelectorAll('[data-dot]');
  if (slides.length > 1) {
    var idx = 0, timer = null;
    function go(n) {
      idx = (n + slides.length) % slides.length;
      slides.forEach(function (el, i) { el.classList.toggle('on', i === idx); });
      panels.forEach(function (el, i) { el.classList.toggle('on', i === idx); });
      dots.forEach(function (el, i) { el.setAttribute('aria-selected', String(i === idx)); });
    }
    function start() { if (!reduce) timer = setInterval(function () { go(idx + 1); }, 6000); }
    dots.forEach(function (d, i) {
      d.addEventListener('click', function () { clearInterval(timer); go(i); start(); });
    });
    go(0);
    start();
  }

  /* ---------- stock ---------- */
  var money = function (n) {
    if (n === null || n === undefined || n === '') return null;
    return '$' + Number(n).toLocaleString('en-NZ', { maximumFractionDigits: 0 });
  };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  function bikeCard(b) {
    var title = [b.year, b.make, b.model].filter(Boolean).join(' ');
    var spec = [];
    if (b.category) spec.push(esc(b.category));
    if (b.odometer_km != null && b.odometer_km !== '') spec.push(Number(b.odometer_km).toLocaleString('en-NZ') + ' km');
    var tag = b.sold ? '<span class="bike-tag bike-tag--sold">Sold</span>'
      : b.condition === 'used' ? '<span class="bike-tag bike-tag--used">Used</span>'
      : '<span class="bike-tag">New</span>';
    var shot = b.image_url
      ? '<img src="' + esc(b.image_url) + '" alt="' + esc(title) + ' at Motoworx Winton" loading="lazy">'
      : '<div class="bike-shot--none" style="position:absolute;inset:0">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 17.5h-6l-2.5-5h7l2 5M12 12.5 10 7h-2M14 7h4"/></svg>' +
          '<span>Photo coming</span></div>';
    var price = money(b.price_nzd);
    return '' +
      '<article class="bike">' +
        '<div class="bike-shot">' + tag + shot + '</div>' +
        '<div class="bike-body">' +
          '<h3>' + esc(title) + '</h3>' +
          (spec.length ? '<div class="bike-spec">' + spec.map(function (s) { return '<span>' + s + '</span>'; }).join('') + '</div>' : '') +
          (b.blurb ? '<p>' + esc(b.blurb) + '</p>' : '') +
          '<div class="bike-foot">' +
            (price ? '<span class="price">' + price + '<small>Ride away</small></span>' : '<span class="price" style="font-size:1.15rem">Ask us<small>For a price</small></span>') +
            '<a class="btn btn--line btn--sm" href="index.html#enquire" data-bike="' + esc(title) + '">Enquire</a>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function skeletons(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += '<div class="skeleton"><div class="sk-img"></div><div class="sk-line"></div><div class="sk-line"></div></div>';
    return s;
  }

  var stockEls = document.querySelectorAll('#bikePreview,#bikeGrid');
  var allBikes = [];

  function paint(filter) {
    stockEls.forEach(function (el) {
      var limit = parseInt(el.getAttribute('data-limit') || '0', 10);
      var list = allBikes.slice();
      if (filter && filter !== 'all') {
        list = list.filter(function (b) {
          return filter === 'sold' ? b.sold : (b.condition === filter && !b.sold);
        });
      } else {
        list = list.filter(function (b) { return !b.sold; });
      }
      if (limit) list = list.slice(0, limit);

      if (!list.length) {
        el.innerHTML = '';
        var host = el.parentElement;
        var existing = host.querySelector('.state[data-auto]');
        if (existing) existing.remove();
        var msg = allBikes.length
          ? 'Nothing in that group at the moment. Try another filter, or ring the shop and we will tell you what is coming in.'
          : 'The floor list is being updated. Ring the shop on ' + (CFG.phone || '') + ' and we will tell you exactly what is in.';
        var div = document.createElement('div');
        div.className = 'state';
        div.setAttribute('data-auto', '');
        div.innerHTML = '<h3>No bikes listed</h3><p>' + msg + '</p>';
        host.appendChild(div);
        return;
      }
      var stale = el.parentElement.querySelector('.state[data-auto]');
      if (stale) stale.remove();
      el.innerHTML = list.map(bikeCard).join('');
    });
  }

  if (stockEls.length) {
    stockEls.forEach(function (el) {
      el.innerHTML = skeletons(parseInt(el.getAttribute('data-limit') || '6', 10) || 6);
    });

    fetch(REST + 'motoworx_bikes?select=*&order=sort_order.desc,created_at.desc', { headers: HEADERS })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (rows) { allBikes = rows || []; paint(currentFilter()); })
      .catch(function () {
        stockEls.forEach(function (el) {
          el.innerHTML = '';
          var div = document.createElement('div');
          div.className = 'state';
          div.setAttribute('data-auto', '');
          div.innerHTML = '<h3>Stock list is not loading</h3><p>Something went wrong fetching the floor list. Ring the shop on ' +
            (CFG.phone || '') + ' and we will tell you what is in.</p>';
          el.parentElement.appendChild(div);
        });
      });
  }

  var filterBar = document.getElementById('stockFilters');
  function currentFilter() {
    if (!filterBar) return 'all';
    var on = filterBar.querySelector('[aria-pressed="true"]');
    return on ? on.getAttribute('data-filter') : 'all';
  }
  if (filterBar) {
    filterBar.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-filter]');
      if (!btn) return;
      filterBar.querySelectorAll('[data-filter]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      paint(btn.getAttribute('data-filter'));
    });
  }

  /* ---------- finance estimator ---------- */
  var amount = document.getElementById('amount');
  if (amount) {
    var term = document.getElementById('term'), rate = document.getElementById('rate');
    var termOut = document.getElementById('termOut'), rateOut = document.getElementById('rateOut');
    var repay = document.getElementById('repay'), repayUnit = document.getElementById('repayUnit');
    var freq = 52;

    function calc() {
      var P = Math.max(0, Number(amount.value) || 0);
      var months = Number(term.value);
      var annual = Number(rate.value) / 100;
      termOut.textContent = months;
      rateOut.textContent = annual === 0 ? '0' : (annual * 100).toFixed(2);

      var monthly;
      if (annual === 0) {
        monthly = P / months;
      } else {
        var i = annual / 12;
        monthly = P * i / (1 - Math.pow(1 + i, -months));
      }
      var perYear = monthly * 12;
      var out = perYear / freq;
      repay.childNodes[0].nodeValue = '$' + (isFinite(out) ? out : 0).toLocaleString('en-NZ', { maximumFractionDigits: 0 });
      repayUnit.textContent = freq === 52 ? 'per week' : freq === 26 ? 'per fortnight' : 'per month';
    }
    [amount, term, rate].forEach(function (el) { el.addEventListener('input', calc); });
    document.querySelectorAll('[data-freq]').forEach(function (b) {
      b.addEventListener('click', function () {
        freq = Number(b.getAttribute('data-freq'));
        document.querySelectorAll('[data-freq]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        calc();
      });
    });
    calc();
  }

  /* ---------- enquiry form ---------- */
  var form = document.getElementById('enquiryForm');
  if (form) {
    var deptInput = document.getElementById('dept');
    var submitBtn = document.getElementById('submitBtn');
    var formOk = document.getElementById('formOk');
    var okDept = document.getElementById('okDept');
    var msgLabel = document.getElementById('msgLabel');
    var bikeLabel = document.getElementById('bikeLabel');

    var COPY = {
      sales: { btn: 'Send to sales', msg: 'What are you after?', bike: 'Bike you are interested in' },
      parts: { btn: 'Send to parts', msg: 'Which part do you need?', bike: 'Make, model and year' },
      workshop: { btn: 'Send to the workshop', msg: 'What needs doing?', bike: 'Bike coming in' }
    };

    function setDept(d) {
      deptInput.value = d;
      document.querySelectorAll('[data-dept]').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.getAttribute('data-dept') === d));
      });
      submitBtn.childNodes[0].nodeValue = COPY[d].btn + ' ';
      msgLabel.textContent = COPY[d].msg;
      bikeLabel.innerHTML = COPY[d].bike + ' <span class="dim">(optional)</span>';
    }
    document.querySelectorAll('[data-dept]').forEach(function (b) {
      b.addEventListener('click', function () { setDept(b.getAttribute('data-dept')); });
    });

    /* Deep links from the department cards and bike cards */
    document.addEventListener('click', function (e) {
      var d = e.target.closest('[data-open-dept]');
      if (d) { setDept(d.getAttribute('data-open-dept')); return; }
      var bk = e.target.closest('[data-bike]');
      if (bk) {
        try { sessionStorage.setItem('mw-bike', bk.getAttribute('data-bike')); } catch (err) {}
      }
    });
    try {
      var pending = sessionStorage.getItem('mw-bike');
      if (pending) {
        document.getElementById('bike').value = pending;
        setDept('sales');
        sessionStorage.removeItem('mw-bike');
      }
    } catch (err) {}

    function setErr(name, msg) {
      var el = form.querySelector('[data-err="' + name + '"]');
      if (el) el.textContent = msg || '';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      ['name', 'email', 'message'].forEach(function (n) { setErr(n, ''); });

      var data = {
        department: deptInput.value,
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim() || null,
        bike: form.bike.value.trim() || null,
        message: form.message.value.trim()
      };

      var bad = false;
      if (!data.name) { setErr('name', 'We need a name to come back to.'); bad = true; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) { setErr('email', 'Check the email address, we cannot reply without it.'); bad = true; }
      if (!data.message) { setErr('message', 'Tell us what you need and we will sort it.'); bad = true; }
      if (bad) { form.querySelector('.field-err:not(:empty)').closest('.field').querySelector('input,textarea').focus(); return; }

      submitBtn.disabled = true;
      submitBtn.childNodes[0].nodeValue = 'Sending ';

      fetch(REST + 'motoworx_enquiries', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }, HEADERS),
        body: JSON.stringify(data)
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        okDept.textContent = data.department;
        form.hidden = true;
        formOk.hidden = false;
        formOk.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        form.reset();
      }).catch(function () {
        setErr('message', 'That did not send. Ring us on ' + (CFG.phone || '') + ' and we will sort it.');
      }).then(function () {
        submitBtn.disabled = false;
        setDept(deptInput.value);
      });
    });

    var again = document.getElementById('againBtn');
    if (again) again.addEventListener('click', function () {
      formOk.hidden = true;
      form.hidden = false;
      form.querySelector('input').focus();
    });

    setDept('sales');
  }
})();
