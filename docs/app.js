(function () {
  // The GitHub slug placeholder — substituted before publish. Everything derived
  // from it is computed at runtime so substitution keeps working.
  var SLUG = "mhshaon98/agent-skills";
  var RAW_BASE = "https://raw.githubusercontent.com/" + SLUG + "/main/";
  var RAW = RAW_BASE + "skills.json";
  var REPO_URL = "https://github.com/" + SLUG;
  var FLOWS = window.SKILL_FLOWS || {};
  var CAT_COLOR = { workflow: "#7cc4f2", safety: "#f2d94a", delegation: "#2ec4a9", formatting: "#8fd67a", tooling: "#b9a7f0" };
  var CALM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SVGNS = "http://www.w3.org/2000/svg";

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svg(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function catColor(c) { return CAT_COLOR[c] || "#eef0ff"; }

  // The name on the hero label glitches between two handles.
  (function () {
    var g = $("glitch"), names = ["hasan", "pow3rcycle"], at = 0, junk = "!<>-_\\/[]{}=+*^?#01";
    if (!g || CALM) return;
    function swap() {
      var to = names[++at % 2], n = 0;
      g.classList.remove("zap"); void g.offsetWidth; g.classList.add("zap");
      var iv = setInterval(function () {
        var out = "";
        for (var i = 0; i < to.length; i++) out += i < n ? to.charAt(i) : junk.charAt((Math.random() * junk.length) | 0);
        g.textContent = out; g.setAttribute("data-text", out);
        if (n++ >= to.length) { clearInterval(iv); g.textContent = to; g.setAttribute("data-text", to); }
      }, 38);
      setTimeout(swap, 2400 + Math.random() * 2200);
    }
    setTimeout(swap, 2600);
  })();
  $("gh-link").href = REPO_URL;
  $("agents-link").href = REPO_URL + "/blob/main/AGENTS.md";

  // Last-updated stamp: the static date in the page is the fallback; the latest
  // commit time from the GitHub API replaces it when reachable.
  fetch("https://api.github.com/repos/" + SLUG + "/commits?per_page=1")
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (c) {
      var iso = c[0].commit.committer.date, t = $("updated");
      t.dateTime = iso;
      t.textContent = new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
    })
    .catch(function () {});

  /* ---------- the dot-matrix face ---------- */
  // 11 x 7 dots. A frame is seven strings; "#" is a lit dot.
  var FRAMES = {
    happy: ["...........", "..##...##..", ".#..#.#..#.", "...........", "..#.....#..", "...#...#...", "....###...."],
    wow:   ["..##...##..", "..##...##..", "..##...##..", "...........", "....###....", "....#.#....", "....###...."],
    heart: ["..##...##..", ".####.####.", ".#########.", "..#######..", "...#####...", "....###....", ".....#....."],
    check: ["...........", ".........#.", "........#..", ".#.....#...", "..#...#....", "...#.#.....", "....#......"],
    sleep: ["...........", "...........", ".###...###.", "...........", "...........", "....###....", "..........."],
    dizzy: ["...........", ".#.#...#.#.", "..#.....#..", ".#.#...#.#.", "...........", "..#.#.#.#..", "...#.#.#..."],
    alert: [".....#.....", ".....#.....", ".....#.....", ".....#.....", "...........", ".....#.....", "..........."],
    bolt:  [".....##....", "....##.....", "...##......", "..######...", ".....##....", "....##.....", "...##......"],
    note:  ["....#####..", "....#...#..", "....#...#..", "....#...#..", "..###.###..", "..###.###..", "..........."],
    wink:  ["...........", "..##.......", "..##...###.", "..##.......", "...........", "...#...#...", "....###...."]
  };
  function idleFrame(dx, dy, shut, mouth) {
    var g = [];
    for (var r = 0; r < 7; r++) g.push("...........".split(""));
    [2, 7].forEach(function (c0) {
      for (var r = 1; r <= 3; r++) {
        if (shut && r !== 2) continue;
        var rr = r + dy;
        for (var c = c0; c < c0 + 2; c++) if (g[rr] && g[rr][c + dx] !== undefined) g[rr][c + dx] = "#";
      }
    });
    if (mouth === "think") { g[5][4] = g[5][5] = g[5][6] = "#"; }
    else { g[5][3] = g[5][7] = "#"; g[6][4] = g[6][5] = g[6][6] = "#"; }
    return g.map(function (row) { return row.join(""); });
  }

  // A face lives either in an SVG (a grid of dots) or on the 3D robot's screen,
  // which the hero scene paints from the frame handed over through window.MASCOT_FACE.
  var bridge = window.MASCOT_FACE = window.MASCOT_FACE || {};
  function Face(host) {
    var dots = [], self = this, on3d = host.tagName.toLowerCase() === "canvas";
    if (!on3d) for (var r = 0; r < 7; r++) for (var c = 0; c < 11; c++) {
      var d = svg("circle", { cx: c + .5, cy: r + .5, r: .34, "class": "dot" });
      host.appendChild(d); dots.push(d);
    }
    this.dx = 0; this.dy = 0; this.mood = null; this.timer = null;
    this.paint = function (frame) {
      if (on3d) { bridge.frame = frame; if (bridge.draw) bridge.draw(frame); return; }
      for (var i = 0; i < 77; i++) dots[i].classList.toggle("on", frame[(i / 11) | 0].charAt(i % 11) === "#");
    };
    this.idle = function (shut) { if (!self.mood) self.paint(idleFrame(self.dx, self.dy, shut)); };
    this.look = function (dx, dy) { if (dx !== self.dx || dy !== self.dy) { self.dx = dx; self.dy = dy; self.idle(); } };
    // Show a named expression, then drift back to idle after `ms` (0 = hold).
    this.show = function (name, ms) {
      clearTimeout(self.timer);
      self.mood = name;
      self.paint(name === "think" ? idleFrame(1, -1, false, "think") : FRAMES[name]);
      if (ms) self.timer = setTimeout(self.rest, ms);
    };
    this.rest = function () { clearTimeout(self.timer); self.mood = null; self.idle(); };
    // Boot: a column sweep, then the face.
    this.boot = function () {
      if (CALM) { self.idle(); return; }
      var col = 0;
      self.mood = "boot";
      (function step() {
        var sweep = [];
        for (var r = 0; r < 7; r++) { var row = ""; for (var c = 0; c < 11; c++) row += (c === col || c === col - 1) ? "#" : "."; sweep.push(row); }
        self.paint(sweep);
        if (++col <= 12) setTimeout(step, 55); else { self.mood = null; self.show("happy", 1100); }
      })();
    };
    if (!CALM) (function blink() {
      setTimeout(function () {
        self.idle(true);
        setTimeout(function () { self.idle(false); blink(); }, 130);
      }, 1800 + Math.random() * 3200);
    })();
  }

  var faces = {};
  Array.prototype.forEach.call(document.querySelectorAll("[data-face]"), function (host) {
    faces[host.getAttribute("data-face")] = new Face(host);
  });
  bridge.show = faces.hero.show; bridge.rest = faces.hero.rest;
  faces.hero.boot();
  faces.buddy.idle();
  faces.panel.idle();

  // Eyes follow the pointer.
  window.addEventListener("pointermove", function (e) {
    ["buddy"].forEach(function (k) {
      var host = document.querySelector('[data-face="' + k + '"]'), b = host.getBoundingClientRect();
      if (!b.width) return;
      var vx = e.clientX - (b.left + b.width / 2), vy = e.clientY - (b.top + b.height / 2);
      faces[k].look(Math.abs(vx) < 90 ? 0 : vx < 0 ? -1 : 1, Math.abs(vy) < 90 ? 0 : vy < 0 ? -1 : 1);
    });
  }, { passive: true });


  // On narrow screens the scene is cropped to the robot's corner of the bench.
  var scene = $("scene"), narrow = window.matchMedia("(max-width: 1099px)");
  function cropScene() { if (scene.tagName.toLowerCase() === "svg") scene.setAttribute("viewBox", narrow.matches ? "560 96 880 664" : "0 0 1440 760"); }
  cropScene();
  if (narrow.addEventListener) narrow.addEventListener("change", cropScene); else narrow.addListener(cropScene);

  // The corner buddy appears once the hero robot has scrolled away.
  var buddy = $("buddy");
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { buddy.classList.toggle("up", !es[0].isIntersecting); }, { threshold: .15 }).observe(scene);
  }
  buddy.addEventListener("click", function () { faces.buddy.show("wow", 900); window.scrollTo({ top: 0, behavior: CALM ? "auto" : "smooth" }); });

  /* ---------- ticker: the phrases that wake a skill ---------- */
  var SAYS = [["catch me up", "call-handoff"], ["ship it", "pre-release-review"], ["wrap up", "update-handoff"], ["is it actually done?", "verify-work"],
    ["audit this app", "app-audit"], ["ask codex", "codex-bridge"], ["make this readable", "apply-richformat"], ["log this", "commissioning-logger"],
    ["what did this cost?", "usage-here"], ["add an admin panel", "client-cms"]];
  var ticker = $("ticker");
  for (var rep = 0; rep < 2; rep++) SAYS.forEach(function (s) {
    var sp = el("span", null, "“" + s[0] + "”");
    sp.appendChild(el("em", null, s[1]));
    ticker.appendChild(sp);
  });

  /* ---------- copy ---------- */
  function copyText(btn, text) {
    var done = function () {
      var prev = btn.textContent;
      btn.textContent = "Copied";
      btn.classList.add("done");
      faces.buddy.show("check", 1400); faces.panel.show("check", 1400);
      setTimeout(function () { btn.textContent = prev; btn.classList.remove("done"); }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }
  function fallbackCopy(text, done) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    (document.querySelector("dialog[open]") || document.body).appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (e) {}
    ta.parentNode.removeChild(ta);
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-copy]");
    if (b) copyText(b, $(b.getAttribute("data-copy")).textContent);
  });

  function installCmd(s) {
    var codexOnly = s.targets && s.targets.indexOf("claude") === -1;
    return "curl -fsSL " + RAW_BASE + "install.sh | bash -s -- " + (codexOnly ? "--codex " : "") + s.name;
  }
  // The starter pack: what a new teammate gets value from first.
  var PICKS = [
    ["call-handoff", "Start every session already knowing where the last one stopped."],
    ["update-handoff", "End every session so tomorrow, or a teammate, can pick it straight up."],
    ["verify-work", "Stops your agent saying \u201cdone\u201d before it has actually run the thing."],
    ["pre-release-review", "A second, fresh pair of eyes on the change before it ships."],
    ["safe-data-write", "Backup first, rollback ready, any time real data is about to change."],
    ["usage-here", "See what a session cost and how much of your limit it used."]
  ];
  $("cmd-picks").textContent = "curl -fsSL " + RAW_BASE + "install.sh | bash -s -- " + PICKS.map(function (p) { return p[0]; }).join(" ");
  function buildPicks() {
    var list = $("pick-list"); list.innerHTML = "";
    PICKS.forEach(function (p) {
      var s = skills.filter(function (k) { return k.name === p[0]; })[0];
      if (!s) return;
      var li = el("li"), b = el("button", "pick rv"); b.type = "button";
      b.style.setProperty("--c", catColor(s.category));
      var name = el("strong", null, s.name); name.appendChild(el("small", null, s.category));
      b.appendChild(name); b.appendChild(el("span", "why", p[1])); b.appendChild(el("b", null, "\u2192"));
      b.addEventListener("click", function () { openPanel(s); });
      li.appendChild(b); list.appendChild(li); reveal(b);
    });
  }
  $("cmd-agent").textContent = "Read " + RAW_BASE + "AGENTS.md and follow its install protocol. List the skills in the catalog, recommend the ones that fit how I work, and install the ones I pick.";
  $("cmd-sh").textContent = "curl -fsSL " + RAW_BASE + "install.sh | bash -s -- verify-work security-pass";
  $("cmd-ps").textContent = '$env:AGENT_SKILLS = "verify-work,security-pass"; irm ' + RAW_BASE + "install.ps1 | iex";
  $("cmd-mp").textContent = "/plugin marketplace add " + SLUG;
  $("cmd-pi").textContent = "/plugin install verify-work@dev-discipline";

  /* ---------- the shelf ---------- */
  var grid = $("grid"), chipsEl = $("chips"), searchEl = $("search"), countEl = $("count"), emptyEl = $("empty");
  var skills = [], activeCat = "all";

  function fileCount(s) {
    return typeof s.file_count === "number" ? s.file_count : (Array.isArray(s.files) ? s.files.length : 1);
  }
  function flowFor(s) {
    return FLOWS[s.name] || { when: "The agent needs it", steps: [["Read the skill", "SKILL.md loads into the session"], ["Follow its steps", s.description]], out: "Done the way the skill says" };
  }

  function render() {
    var q = searchEl.value.trim().toLowerCase();
    var shown = skills.filter(function (s) {
      if (activeCat !== "all" && s.category !== activeCat) return false;
      if (!q) return true;
      var f = flowFor(s);
      return (s.name + " " + s.description + " " + s.category + " " + f.when + " " + f.out).toLowerCase().indexOf(q) !== -1;
    });

    grid.innerHTML = "";
    emptyEl.hidden = shown.length !== 0;
    countEl.textContent = "Showing " + shown.length + " of " + skills.length;
    if (!shown.length) faces.buddy.show("sleep", 1600);

    shown.forEach(function (s, i) {
      var f = flowFor(s);
      var card = el("button", "cart");
      card.type = "button";
      card.style.setProperty("--c", catColor(s.category));
      card.style.setProperty("--i", Math.min(i, 12));
      card.appendChild(el("span", "cart-cat", s.category));
      card.appendChild(el("span", "cart-name", s.name));
      card.appendChild(el("span", "cart-when", f.out + "."));
      // The first cartridge of each category is shown wide, with its flow in miniature.
      if (!q && activeCat === "all" && (i === 0 || shown[i - 1].category !== s.category)) {
        card.classList.add("wide");
        var mini = el("span", "mini");
        mini.appendChild(el("span", null, f.when));
        f.steps.slice(0, 4).forEach(function (st) { mini.appendChild(el("b", null, "\u2192")); mini.appendChild(el("span", null, st[0])); });
        card.appendChild(mini);
      }
      var foot = el("span", "cart-foot");
      var n = fileCount(s);
      foot.appendChild(el("span", null, n + " file" + (n === 1 ? "" : "s") +
        (s.targets && s.targets.length === 1 ? " · " + (s.targets[0] === "codex" ? "Codex only" : "Claude only") : "")));
      var go = el("span", "cart-go", "See the flow ");
      go.appendChild(el("b", null, "→"));
      foot.appendChild(go);
      card.appendChild(foot);
      card.appendChild(el("span", "pins"));
      card.addEventListener("click", function () { openPanel(s); });
      card.addEventListener("pointerenter", function () { faces.buddy.show("wow", 700); });
      grid.appendChild(card);
      reveal(card);
    });
  }

  function buildChips() {
    var cats = ["all"];
    skills.forEach(function (s) { if (cats.indexOf(s.category) === -1) cats.push(s.category); });
    chipsEl.innerHTML = "";
    cats.forEach(function (c) {
      var chip = el("button", "chip");
      chip.type = "button";
      if (c !== "all") { chip.style.setProperty("--c", catColor(c)); chip.appendChild(el("i")); }
      chip.appendChild(document.createTextNode(c));
      chip.setAttribute("aria-pressed", c === activeCat ? "true" : "false");
      chip.addEventListener("click", function () {
        activeCat = c;
        Array.prototype.forEach.call(chipsEl.children, function (n) { n.setAttribute("aria-pressed", n === chip ? "true" : "false"); });
        render();
      });
      chipsEl.appendChild(chip);
    });
  }

  function load() {
    fetch("../skills.json")
      .then(function (r) { if (!r.ok) throw new Error("local miss"); return r.json(); })
      .catch(function () { return fetch(RAW).then(function (r) { return r.json(); }); })
      .then(function (data) {
        skills = Array.isArray(data) ? data : (data && Array.isArray(data.skills) ? data.skills : []);
        $("total").textContent = skills.length + " skills";
        buildChips();
        render();
        buildPicks();
        var want = decodeURIComponent(location.hash.slice(1));
        skills.some(function (s) { if (s.name === want) { openPanel(s); return true; } });
      })
      .catch(function () {
        countEl.textContent = "";
        emptyEl.hidden = false;
        emptyEl.textContent = "Could not load skills.json.";
      });
  }

  /* ---------- scroll reveal ---------- */
  var io = "IntersectionObserver" in window && !CALM
    ? new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
      }, { rootMargin: "0px 0px -8% 0px" })
    : null;
  function reveal(n) { if (io) io.observe(n); else n.classList.add("in"); }
  Array.prototype.forEach.call(document.querySelectorAll(".rv"), reveal);

  /* ---------- the skill panel and its flow chart ---------- */
  var panel = $("panel"), flowBox = $("flow"), flowGrid = $("flow-grid"), wires = $("wires");
  var current = null, raf = 0, timers = [];

  function stopFlow() {
    cancelAnimationFrame(raf);
    timers.forEach(clearTimeout); timers = [];
  }

  function openPanel(s) {
    current = s;
    var f = flowFor(s), n = fileCount(s);
    panel.style.setProperty("--c", catColor(s.category));
    $("panel-cat").textContent = s.category;
    $("panel-name").textContent = s.name;
    $("panel-desc").textContent = s.description;
    $("panel-cmd").textContent = installCmd(s);
    $("panel-files").textContent = n + " file" + (n === 1 ? "" : "s") + " · " +
      (s.targets || []).map(function (t) { return t === "codex" ? "Codex CLI" : "Claude Code"; }).join(" + ");
    $("panel-src").href = REPO_URL + "/blob/main/" + s.path + "/SKILL.md";
    if (!panel.open) panel.showModal();
    panel.scrollTop = 0;
    if (history.replaceState) history.replaceState(null, "", "#" + s.name);
    buildFlow(f, true);
  }

  function buildFlow(f, animate) {
    stopFlow();
    flowGrid.innerHTML = "";
    while (wires.firstChild) wires.removeChild(wires.firstChild);

    var items = [{ kind: "when", tag: "When", label: f.when }];
    f.steps.forEach(function (st, i) { items.push({ kind: st[2] === "check" ? "check" : "step", tag: "Step " + (i + 1) + (st[2] === "check" ? " \u00b7 decide" : ""), label: st[0], note: st[1], back: st[3] }); });
    items.push({ kind: "out", tag: "Result", label: f.out });

    var cols = flowBox.clientWidth >= 760 ? 3 : flowBox.clientWidth >= 500 ? 2 : 1;
    flowGrid.style.setProperty("--cols", cols);
    var nodes = items.map(function (it, i) {
      var row = (i / cols) | 0, pos = i % cols;
      var node = el("div", "node " + it.kind);
      node.style.gridRow = row + 1;
      node.style.gridColumn = (row % 2 ? cols - 1 - pos : pos) + 1; // serpentine
      node.appendChild(el("small", null, it.tag));
      node.appendChild(el("strong", null, it.label));
      if (it.note) node.appendChild(el("span", null, it.note));
      if (it.back) node.appendChild(el("b", "back", "↺ " + it.back));
      flowGrid.appendChild(node);
      return node;
    });

    // One wire through every node centre; the opaque nodes sit on top of it.
    // Layout boxes, not getBoundingClientRect: the nodes are still scaled down for their pop-in.
    var box = { left: 0, top: 0 };
    var pts = nodes.map(function (n) {
      var b = { left: n.offsetLeft, top: n.offsetTop, right: n.offsetLeft + n.offsetWidth, bottom: n.offsetTop + n.offsetHeight };
      return [b.left + n.offsetWidth / 2, b.top + n.offsetHeight / 2, b];
    });
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ");
    wires.appendChild(svg("path", { d: d, "class": "wire" }));
    var hot = svg("path", { d: d, "class": "wire hot" });
    wires.appendChild(hot);
    var total = hot.getTotalLength(), marks = [0], arrows = [];
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
      marks.push(marks[i - 1] + seg);
      // Arrowhead in the gap between the two nodes.
      var horiz = Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]);
      var gx = horiz ? (b[0] > a[0] ? (a[2].right + b[2].left) / 2 : (a[2].left + b[2].right) / 2) - box.left : a[0];
      var gy = horiz ? a[1] : (a[2].bottom + b[2].top) / 2 - box.top;
      var deg = horiz ? (b[0] > a[0] ? 0 : 180) : 90;
      var ar = svg("path", { d: "M-9 -10 L9 0 L-9 10 Z", "class": "arrow", transform: "translate(" + gx.toFixed(1) + " " + gy.toFixed(1) + ") rotate(" + deg + ")" });
      wires.appendChild(ar); arrows.push(ar);
    }
    var packet = svg("circle", { r: 9, "class": "packet", cx: pts[0][0], cy: pts[0][1] });
    wires.appendChild(packet);

    if (CALM || !animate) {
      nodes.forEach(function (n) { n.classList.add("in"); });
      arrows.forEach(function (a) { a.classList.add("in"); });
      packet.setAttribute("opacity", 0);
      return;
    }

    // Draw-in: the wire extends, each node pops as the wire reaches it.
    faces.panel.show("think");
    hot.style.strokeDasharray = total;
    hot.style.strokeDashoffset = total;
    var STEP = 340, t0 = performance.now(), drawMs = STEP * (pts.length - 1) + 200;
    nodes.forEach(function (n, i) {
      timers.push(setTimeout(function () { n.classList.add("in"); if (i) arrows[i - 1].classList.add("in"); }, 120 + i * STEP));
    });
    timers.push(setTimeout(function () { faces.panel.show("happy", 1600); }, drawMs));

    // Then a packet runs the route on a loop and lights the node it is passing.
    var SPEED = 190, live = -1;
    (function tick(now) {
      var el2 = now - t0;
      if (el2 < drawMs) {
        hot.style.strokeDashoffset = total * (1 - Math.min(1, el2 / (drawMs - 200)));
        packet.setAttribute("opacity", 0);
      } else {
        hot.style.strokeDashoffset = 0;
        var pause = 900, lap = total / SPEED * 1000 + pause, t = (el2 - drawMs) % lap;
        var dist = Math.min(total, t / 1000 * SPEED), p = hot.getPointAtLength(dist);
        packet.setAttribute("opacity", 1);
        packet.setAttribute("cx", p.x); packet.setAttribute("cy", p.y);
        var idx = 0;
        while (idx < marks.length - 1 && marks[idx + 1] - 40 <= dist) idx++;
        if (idx !== live) {
          if (nodes[live]) nodes[live].classList.remove("live");
          nodes[idx].classList.add("live"); live = idx;
        }
      }
      raf = requestAnimationFrame(tick);
    })(t0);
  }

  function closePanel() { panel.close(); }
  $("panel-x").addEventListener("click", closePanel);
  panel.addEventListener("click", function (e) { if (e.target === panel) closePanel(); });
  panel.addEventListener("close", function () {
    stopFlow(); current = null; faces.panel.rest();
    if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
  });
  var rz;
  window.addEventListener("resize", function () {
    clearTimeout(rz);
    rz = setTimeout(function () { if (current && panel.open) buildFlow(flowFor(current), false); }, 150);
  });

  /* ---------- static sections ---------- */
  // Upstream frameworks/skills and playbooks are not in skills.json, since nothing
  // here is installed by install.sh. Keep in sync with README.md and playbooks/README.md.
  var UPSTREAM = [
    { name: "Remotion", tag: "video framework", url: "https://github.com/remotion-dev/skills",
      desc: "The recommended video framework: programmatic React video, captions, rendering. Chosen over HyperFrames after a head-to-head on output quality. Both video playbooks are built on it.",
      cmd: "npx skills add remotion-dev/skills" },
    { name: "last30days", tag: "research", url: "https://github.com/mvanhorn/last30days-skill",
      desc: "Broad multi-source social-sentiment research over the last 30 days." },
    { name: "defuddle", tag: "research", url: "https://github.com/kepano/obsidian-skills",
      desc: "Extract clean markdown from web pages, token-efficiently." },
    { name: "agent-browser", tag: "tooling", url: "https://github.com/vercel-labs/agent-browser",
      desc: "Browser-automation CLI built for AI agents." },
    { name: "impeccable", tag: "design", url: "https://github.com/pbakaus/impeccable",
      desc: "Design-system craft skill for frontend UI work." },
    { name: "taste-skill", tag: "design", url: "https://github.com/Leonxlnx/taste-skill",
      desc: "Elite UX/UI and motion-engineering taste." },
    { name: "design-motion-principles", tag: "design", url: "https://github.com/kylezantos/design-motion-principles",
      desc: "Build or audit UI motion with intent." }
  ];
  var PLAYBOOKS = [
    ["character-narrated-video", "video", "Remotion pipeline for a mascot narrating a short video: measured voice timeline, spring-based rig, checks, review ritual."],
    ["device-demo-video", "video", "Remotion recipe for an app shown on real device hardware in motion: recreated UI, fold/flip moves, foley, checks, deliverables."],
    ["architecture-playbook", "engineering", "Architecture defaults per project type, the least-code ladder, invariants against design drift, storage decision guide."],
    ["verification-and-quality", "engineering", "Verification ladder, Verified/NOT-verified ledger, debugging discipline, code-quality, refactor and release checklists."],
    ["security-and-secrets", "safety", "Secrets hygiene, backend RLS/advisor rules, client permission boundaries, security-pass checklist, resource-exhaustion hardening."],
    ["cloudflare-cost-safety", "safety", "Why spend ceilings are plan settings, one-way-door upgrade rules, KV/R2 cost-aware design, deploy checklist."],
    ["model-and-agent-strategy", "delegation", "Model tiers, explicit model pinning, when (not) to spawn subagents, agent roster, orchestration and cost rules."],
    ["token-efficiency", "delegation", "Evidence-tagged levers for cutting fixed context, round-trips, and per-operation token cost."],
    ["communication-and-autonomy", "workflow", "Outcome-first reporting, honesty rules, proceed-vs-ask calibration, UI iteration protocol."],
    ["codex-image-pipeline", "media", "Headless AI image generation via the Codex CLI, brief rules, mapped failure modes."],
    ["social-marketing-visuals", "media", "The grid-mix rule for social feeds and the production notes that travel with it."]
  ];
  var TAG_COLOR = { video: "#f2d94a", "video framework": "#f2d94a", research: "#8fd67a", design: "#b9a7f0", engineering: "#eef6f2", media: "#7cc4f2" };

  function staticRow(o) {
    var a = el("a", "row rv");
    a.href = o.url; a.target = "_blank"; a.rel = "noopener";
    a.style.setProperty("--c", TAG_COLOR[o.tag] || catColor(o.tag));
    a.appendChild(el("i"));
    a.appendChild(el("strong", null, o.name));
    a.appendChild(el("em", null, o.tag));
    a.appendChild(el("p", null, o.desc));
    if (o.cmd) a.appendChild(el("span", "cmdline", o.cmd));
    reveal(a);
    return a;
  }
  UPSTREAM.forEach(function (o) { $("upstream-grid").appendChild(staticRow(o)); });
  PLAYBOOKS.forEach(function (p) {
    $("playbook-grid").appendChild(staticRow({ name: p[0], tag: p[1], desc: p[2], url: REPO_URL + "/blob/main/playbooks/" + p[0] + ".md" }));
  });

  searchEl.addEventListener("input", render);
  load();
})();
