/* Boot: render the defenses from the defenses-N.json shards, then start the app.
   The cards live in shards (not one big file) because a single defenses.json
   outgrew what the push tooling can transport. The loader concatenates the
   shards in order below, so the rest of the app sees one plain array.
   To update content, edit the shard files — no code changes needed.
   If the last shard nears ~100KB, start a new defenses-N.json and add it to
   the SHARDS list in the fetch call. */
function pad2(n) { return String(n).padStart(2, "0"); }
  function levelLabel(l) { return l === "advanced" ? "Advanced" : l === "beginner" ? "Beginner" : "Intermediate"; }
  function basisLabel(b) { return b === "doctrine" ? "Defined doctrine" : b === "history" ? "Historical record" : "Theological reasoning"; }
  function audienceLabel(a) { return a === "catholic" ? "Catholic teaching" : "Common ground"; }

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Tappable glossary terms: first mention of a glossary term inside a card
   becomes a button that opens its definition. Glossary section stays as the index. */
var GLOSS_SORTED = null;
function glossSorted() {
  if (!GLOSS_SORTED) {
    GLOSS_SORTED = (window.GLOSSARY || []).slice().sort(function (a, b) { return b.term.length - a.term.length; });
  }
  return GLOSS_SORTED;
}
function escRx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function matchGlossTerm(text, term) {
  var rx;
  try {
    rx = new RegExp("(?<![\\p{L}\\p{N}])" + escRx(term) + "(?:s)?(?![\\p{L}\\p{N}])", "iu");
  } catch (e) { return null; }
  var m = rx.exec(text);
  return m ? { index: m.index, length: m[0].length } : null;
}
function linkGlossaryTerms(html) {
  var terms = glossSorted();
  if (!terms.length || !html) return html;
  var div = document.createElement("div");
  div.innerHTML = html;
  var seen = {};
  var walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT, {
    acceptNode: function (n) {
      var p = n.parentNode;
      while (p && p !== div) {
        var t = p.tagName;
        if (t === "A" || t === "BUTTON") return NodeFilter.FILTER_REJECT;
        p = p.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  var nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(function (node) {
    var rest = node.nodeValue;
    var frag = document.createDocumentFragment();
    var made = false;
    while (rest) {
      var best = null;
      for (var i = 0; i < terms.length; i++) {
        var g = terms[i];
        if (seen[g.term]) continue;
        var m = matchGlossTerm(rest, g.term);
        if (m && (!best || m.index < best.index || (m.index === best.index && g.term.length > best.g.term.length))) {
          best = { index: m.index, length: m.length, g: g };
          if (m.index === 0) break;
        }
      }
      if (!best) break;
      made = true;
      frag.appendChild(document.createTextNode(rest.slice(0, best.index)));
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gloss-term";
      btn.setAttribute("data-gloss", best.g.term);
      btn.setAttribute("aria-label", "Definition of " + best.g.term);
      btn.textContent = rest.slice(best.index, best.index + best.length);
      frag.appendChild(btn);
      seen[best.g.term] = true;
      rest = rest.slice(best.index + best.length);
    }
    if (made) {
      frag.appendChild(document.createTextNode(rest));
      node.parentNode.replaceChild(frag, node);
    }
  });
  return div.innerHTML;
}

function renderGlossary(items) {
  var track = document.getElementById("glossaryTrack");
  var dotsWrap = document.getElementById("glossaryDots");
  var counter = document.getElementById("glossaryCounter");
  var prev = document.getElementById("glossaryPrev");
  var next = document.getElementById("glossaryNext");
  var viewport = document.getElementById("glossaryViewport");
  if (!track || !items || !items.length) return;
  var sorted = items.slice().sort(function (a, b) {
    return a.term.toLowerCase().localeCompare(b.term.toLowerCase());
  });
  track.innerHTML = sorted.map(function (item, i) {
    var letter = item.term.charAt(0).toUpperCase();
    return '<article class="glossary-slide" aria-hidden="' + (i === 0 ? "false" : "true") + '"' +
      (i === 0 ? "" : " inert") + ">" +
      '<p class="glossary-letter">' + escapeHtml(letter) + "</p>" +
      "<h3>" + escapeHtml(item.term) +
      ' <span class="glossary-pron">(' + escapeHtml(item.pronunciation) + ")</span></h3>" +
      "<p>" + escapeHtml(item.definition) + "</p>" +
      "</article>";
  }).join("");
  var slides = Array.prototype.slice.call(track.children);
  var current = 0;

  if (dotsWrap) {
    dotsWrap.innerHTML = "";
    slides.forEach(function (slide, i) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "deck-dot";
      dot.setAttribute("aria-label", "Show term " + (i + 1) + ": " + sorted[i].term);
      dot.setAttribute("aria-current", i === 0 ? "true" : "false");
      dot.addEventListener("click", function () { showTerm(i, true); });
      dotsWrap.appendChild(dot);
    });
  }

  function showTerm(index, scroll) {
    current = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach(function (slide, si) {
      var active = si === current;
      slide.setAttribute("aria-hidden", active ? "false" : "true");
      if (active) slide.removeAttribute("inert");
      else slide.setAttribute("inert", "");
    });
    if (dotsWrap) {
      Array.prototype.slice.call(dotsWrap.children).forEach(function (dot, di) {
        dot.setAttribute("aria-current", di === current ? "true" : "false");
      });
    }
    if (prev) prev.disabled = current === 0;
    if (next) next.disabled = current === slides.length - 1;
    if (counter) counter.textContent = "Term " + (current + 1) + " of " + slides.length;
    if (scroll && viewport) scrollToEl(viewport);
  }

  if (prev) prev.addEventListener("click", function () { showTerm(current - 1); });
  if (next) next.addEventListener("click", function () { showTerm(current + 1); });
  if (viewport) {
    viewport.addEventListener("keydown", function (event) {
      if (event.target !== viewport) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); showTerm(current - 1); }
      if (event.key === "ArrowRight") { event.preventDefault(); showTerm(current + 1); }
    });
    var touchStartX = 0;
    var touchStartY = 0;
    var touchTracking = false;
    viewport.addEventListener("touchstart", function (event) {
      if (event.touches.length !== 1) return;
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
      touchTracking = true;
    }, { passive: true });
    viewport.addEventListener("touchend", function (event) {
      if (!touchTracking || !event.changedTouches.length) return;
      touchTracking = false;
      var dx = event.changedTouches[0].clientX - touchStartX;
      var dy = event.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) < 52 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
      showTerm(dx < 0 ? current + 1 : current - 1);
    }, { passive: true });
    viewport.addEventListener("touchcancel", function () { touchTracking = false; }, { passive: true });
  }

  showTerm(0);
}

function renderApostles(items) {
  var track = document.getElementById("apostlesTrack");
  var dotsWrap = document.getElementById("apostlesDots");
  var counter = document.getElementById("apostlesCounter");
  var prev = document.getElementById("apostlesPrev");
  var next = document.getElementById("apostlesNext");
  var viewport = document.getElementById("apostlesViewport");
  if (!track || !items || !items.length) return;
  var relClass = {
    "Well attested": "rel-high",
    "Early tradition": "rel-mid",
    "Later accounts": "rel-late",
    "Scripture": "rel-high"
  };
  track.innerHTML = items.map(function (a, i) {
    var meta = [];
    if (a.alsoKnownAs) meta.push("Also known as " + a.alsoKnownAs);
    meta.push("Feast: " + a.feast);
    return '<article class="apostle" aria-hidden="' + (i === 0 ? "false" : "true") + '"' +
      (i === 0 ? "" : " inert") + ">" +
      '<p class="apostle-epithet">' + escapeHtml(a.epithet) + "</p>" +
      "<h3>" + escapeHtml(a.name) + "</h3>" +
      '<p class="apostle-meta">' + escapeHtml(meta.join(" · ")) + "</p>" +
      "<h4>In Scripture</h4><p>" + escapeHtml(a.scripture) + "</p>" +
      '<p class="apostle-refs">' + escapeHtml(a.scriptureRefs) + "</p>" +
      '<h4>In Tradition <span class="rel ' + (relClass[a.reliability] || "rel-late") + '">' +
      escapeHtml(a.reliability) + "</span></h4>" +
      "<p>" + escapeHtml(a.tradition) + "</p>" +
      '<p class="apostle-note">' + escapeHtml(a.reliabilityNote) + "</p>" +
      "</article>";
  }).join("");
  var slides = Array.prototype.slice.call(track.children);
  var current = 0;

  if (dotsWrap) {
    dotsWrap.innerHTML = "";
    slides.forEach(function (slide, i) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "deck-dot";
      dot.setAttribute("aria-label", "Show apostle " + (i + 1) + ": " + items[i].name);
      dot.setAttribute("aria-current", i === 0 ? "true" : "false");
      dot.addEventListener("click", function () { showApostle(i, true); });
      dotsWrap.appendChild(dot);
    });
  }

  function showApostle(index, scroll) {
    current = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach(function (slide, si) {
      var active = si === current;
      slide.setAttribute("aria-hidden", active ? "false" : "true");
      if (active) slide.removeAttribute("inert");
      else slide.setAttribute("inert", "");
    });
    if (dotsWrap) {
      Array.prototype.slice.call(dotsWrap.children).forEach(function (dot, di) {
        dot.setAttribute("aria-current", di === current ? "true" : "false");
      });
    }
    if (prev) prev.disabled = current === 0;
    if (next) next.disabled = current === slides.length - 1;
    if (counter) counter.textContent = "Apostle " + (current + 1) + " of " + slides.length;
    if (scroll && viewport) scrollToEl(viewport);
  }

  if (prev) prev.addEventListener("click", function () { showApostle(current - 1); });
  if (next) next.addEventListener("click", function () { showApostle(current + 1); });
  if (viewport) {
    viewport.addEventListener("keydown", function (event) {
      if (event.target !== viewport) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); showApostle(current - 1); }
      if (event.key === "ArrowRight") { event.preventDefault(); showApostle(current + 1); }
    });
    var touchStartX = 0;
    var touchStartY = 0;
    var touchTracking = false;
    viewport.addEventListener("touchstart", function (event) {
      if (event.touches.length !== 1) return;
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
      touchTracking = true;
    }, { passive: true });
    viewport.addEventListener("touchend", function (event) {
      if (!touchTracking || !event.changedTouches.length) return;
      touchTracking = false;
      var dx = event.changedTouches[0].clientX - touchStartX;
      var dy = event.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) < 52 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
      showApostle(dx < 0 ? current + 1 : current - 1);
    }, { passive: true });
    viewport.addEventListener("touchcancel", function () { touchTracking = false; }, { passive: true });
  }

  showApostle(0);
}

var CAN_READ_ALOUD = typeof window !== "undefined" && "speechSynthesis" in window;
var REDUCE_MOTION = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function scrollToEl(el) {
  if (!el || !el.scrollIntoView) return;
  el.scrollIntoView({ behavior: REDUCE_MOTION ? "auto" : "smooth", block: "start" });
}

/* Bookmarks ("My Armory"): saved defense slugs, persisted per device. */
var BOOKMARK_KEY = "ca_bookmarks_v1";
function loadBookmarks() {
  try {
    var v = JSON.parse(localStorage.getItem(BOOKMARK_KEY));
    return Array.isArray(v) ? v.filter(function (s) { return typeof s === "string"; }) : [];
  } catch (e) { return []; }
}
function saveBookmarks(list) {
  try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify(list)); } catch (e) {}
}
function isBookmarked(slug) { return loadBookmarks().indexOf(slug) !== -1; }
function toggleBookmark(slug) {
  var list = loadBookmarks();
  var i = list.indexOf(slug);
  if (i !== -1) list.splice(i, 1); else list.push(slug);
  saveBookmarks(list);
  return i === -1;
}
function isNewCard(card) {
  if (!card.added || !/^\d{4}-\d{2}-\d{2}$/.test(card.added)) return false;
  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  var added = new Date(card.added + "T00:00:00").getTime();
  return added >= cutoff.getTime() && added <= today.getTime();
}
function renderStandardCard(card, n, total) {
  var points = linkGlossaryTerms(card.response.map(function (p, k) {
    return '<li><span class="num">' + pad2(k + 1) + '</span> <div><b>' + p.heading + '</b> ' + p.body + '</div></li>';
  }).join(""));
  var verses = card.verses.map(function (v) {
    if (verseRefVerses(parseVerseRef(v))) return '<button type="button" class="verse-ref" data-verse="' + v.replace(/"/g, "") + '">' + v + "</button>";
    return "<span>" + v + "</span>";
  }).join("");
  var related = card.related.map(function (r) {
    var b = document.createElement("b"); b.textContent = r.title;
    var d = document.createElement("button"); d.type = "button"; d.className = "reference";
    d.setAttribute("data-related-title", r.title);
    d.appendChild(b);
    if (r.description) { var s = document.createElement("span"); s.textContent = r.description; d.appendChild(s); }
    return d.outerHTML;
  }).join("");
  return (
    '<div class="entry-top"><div>' +
    (card.topic ? '<span class="entry-topic">' + card.topic + "</span>" : "") +
    (card.level ? '<span class="level-pill level-' + card.level + '">' + levelLabel(card.level) + "</span>" : "") +
    (card.basis ? '<span class="basis-pill basis-' + card.basis + '">' + basisLabel(card.basis) + "</span>" : "") +
    (card.audience ? '<span class="audience-pill audience-' + card.audience + '">' + audienceLabel(card.audience) + "</span>" : "") +
    (isNewCard(card) ? '<span class="new-pill">New</span>' : "") +
    "<h3>" + card.title + "</h3>" +
    '<p class="entry-lede">' + linkGlossaryTerms(card.objection) + "</p>" +
    '<button type="button" class="share-btn" data-share>⧉ Copy link to this defense</button>' +
    (CAN_READ_ALOUD ? '<button type="button" class="share-btn" data-read>🔊 Listen</button>' : "") +
    '<button type="button" class="share-btn" data-bookmark aria-pressed="' + (isBookmarked(card.slug) ? "true" : "false") + '">' + (isBookmarked(card.slug) ? "★ Saved to My Armory" : "☆ Save to My Armory") + "</button>" +
    '<a class="share-btn" href="https://github.com/arkayb9ner/apologetics-guide/issues/new?title=' + encodeURIComponent("Correction for defense #" + n + ": " + card.title) + "&body=" + encodeURIComponent("**Defense:** #" + n + " — " + card.title + "\n**Link:** https://christianarmory.org/#answer-" + card.slug + "\n\n**What looks wrong or unclear:**\n\n\n**Suggested wording (optional):\n") + '" target="_blank" rel="noopener">✎ Found an error? Let us know</a>' +
    "</div><blockquote>" + card.summary + "</blockquote></div>" +
    '<div class="entry-body">' +
    '<nav class="entry-nav" aria-label="' + card.title.replace(/"/g, "") + ' answer sections" role="tablist">' +
    '<button type="button" role="tab" aria-selected="true" aria-controls="' + card.slug + '-response" data-panel="response">Catholic response</button>' +
    '<button type="button" role="tab" aria-selected="false" aria-controls="' + card.slug + '-simple" data-panel="simple">Simply put</button>' +
    '<button type="button" role="tab" aria-selected="false" aria-controls="' + card.slug + '-oneliner" data-panel="oneliner">One-liner</button>' +
    '<button type="button" role="tab" aria-selected="false" aria-controls="' + card.slug + '-related" data-panel="related">See also</button>' +
    "</nav><div>" +
    '<section class="panel active" id="' + card.slug + '-response" role="tabpanel">' +
    '<ol class="answer-pillars">' + points + "</ol>" +
    '<aside class="quick-ref" aria-label="Quick references"><h4>Verses to remember</h4>' +
    '<div class="verse-list">' + verses + "</div>" +
    "<p><b>Catechism:</b> " + card.ccc + "</p></aside></section>" +
    '<section class="panel" id="' + card.slug + '-simple" role="tabpanel"><h4>Simply put</h4>' +
    '<p class="say-it simple-put">' + linkGlossaryTerms(card.simple) + "</p></section>" +
    '<section class="panel" id="' + card.slug + '-oneliner" role="tabpanel"><h4>The one-liner</h4>' +
    '<p class="say-it">' + linkGlossaryTerms(card.oneLiner) + "</p></section>" +
    '<section class="panel" id="' + card.slug + '-related" role="tabpanel"><h4>See also</h4>' +
    '<div class="references">' + related + "</div></section>" +
    "</div></div>"
  );
}

var CCC_INDEX = [
  [1, 234, "ccc/ccc-01.json"], [235, 440, "ccc/ccc-02.json"], [441, 630, "ccc/ccc-03.json"],
  [631, 813, "ccc/ccc-04.json"], [814, 1012, "ccc/ccc-05.json"], [1013, 1209, "ccc/ccc-06.json"],
  [1210, 1408, "ccc/ccc-07.json"], [1409, 1605, "ccc/ccc-08.json"], [1606, 1829, "ccc/ccc-09.json"],
  [1830, 2069, "ccc/ccc-10.json"], [2070, 2297, "ccc/ccc-11.json"], [2298, 2521, "ccc/ccc-12.json"],
  [2522, 2732, "ccc/ccc-13.json"], [2733, 2865, "ccc/ccc-14.json"]
];
var cccCache = {};
var cccCurrent = 0;

function cccShardFor(n) {
  for (var i = 0; i < CCC_INDEX.length; i++) {
    if (n >= CCC_INDEX[i][0] && n <= CCC_INDEX[i][1]) return CCC_INDEX[i][2];
  }
  return null;
}

function cccParagraph(n, cb) {
  n = Math.max(1, Math.min(2865, n));
  var file = cccShardFor(n);
  if (cccCache[file]) { cb(n, cccCache[file].paragraphs[String(n)]); return; }
  fetch(file + "?v=" + ASSET_V).then(function (r) { return r.json(); }).then(function (data) {
    cccCache[file] = data;
    cb(n, data.paragraphs[String(n)]);
  }).catch(function () { cb(n, null); });
}

function renderCccModal(n) {
  cccCurrent = Math.max(1, Math.min(2865, n));
  var body = document.getElementById("cccModalBody");
  document.getElementById("cccModalTitle").textContent = "Catechism \u00b6 " + cccCurrent;
  body.innerHTML = "<p>Loading\u2026</p>";
  document.getElementById("cccModalPrev").disabled = (cccCurrent <= 1);
  document.getElementById("cccModalNext").disabled = (cccCurrent >= 2865);
  cccParagraph(cccCurrent, function (num, html) {
    if (num !== cccCurrent) return;
    body.innerHTML = html || "<p>Could not load this paragraph. Check your connection and try again.</p>";
    body.scrollTop = 0;
  });
}

function openCccModal(n) {
  renderCccModal(n);
  document.getElementById("cccModalBackdrop").hidden = false;
  document.getElementById("cccModalClose").focus();
}

function closeCccModal() {
  document.getElementById("cccModalBackdrop").hidden = true;
}

function linkCccRefs(root) {
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      if (node.parentElement && node.parentElement.closest(".ccc-ref")) return NodeFilter.FILTER_REJECT;
      return (/CCC\s+\d/.test(node.nodeValue) || /Catechism\s*(?:[(:¶,]\s*)?\d/.test(node.nodeValue)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  var nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(function (node) {
    // Matches "CCC 2358" (with optional ranges) and "Catechism (2358)" / "Catechism ¶ 2358" /
    // "Catechism 2358", so a future card written in the Catechism-first form still links.
    var re = /(CCC\s+(\d+)|Catechism\s*(?:[(:¶,]\s*)?(\d+))((?:\s*[-\u2013\u2014,;]\s*(?:cf\.\s*)?\d+)*)/g;
    var frag = document.createDocumentFragment();
    var last = 0, m;
    while ((m = re.exec(node.nodeValue))) {
      frag.appendChild(document.createTextNode(node.nodeValue.slice(last, m.index)));
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ccc-ref";
      btn.setAttribute("data-ccc", m[2] || m[3]);
      btn.setAttribute("aria-label", "Read Catechism paragraph " + (m[2] || m[3]));
      btn.textContent = m[0];
      frag.appendChild(btn);
      last = m.index + m[0].length;
    }
    frag.appendChild(document.createTextNode(node.nodeValue.slice(last)));
    node.parentNode.replaceChild(frag, node);
  });
}

/* Scripture popups (CPDV): every cited verse opens the CPDV text in a modal.
   verses-1.json / verses-2.json are built by dev/build-verses.py from the CPDV
   JSON conversion of sacredbible.org (sharded: one verses.json outgrew the
   push size ceiling). Keys use the site's numbering; Psalm/Vulgate offsets are
   resolved at build time, so the client looks up site numbering directly.
   Bare "5:21" continuations and Qur'an refs never match: a Bible book name
   is required. */
var VERSE_ALIASES = {
  Matt: "Matthew", Mt: "Matthew", Mk: "Mark", Lk: "Luke", Jn: "John", Gen: "Genesis",
  Heb: "Hebrews", Eph: "Ephesians", Rev: "Revelation", Ps: "Psalm",
  Phil: "Philippians", Rom: "Romans", Gal: "Galatians", Col: "Colossians", Deut: "Deuteronomy",
  Jas: "James", Cor: "Corinthians", Tim: "Timothy", Thess: "Thessalonians", Pet: "Peter",
  Sam: "Samuel", Macc: "Maccabees", Chron: "Chronicles"
};
var VERSE_BOOK_TOKENS = ["Song of Songs", "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "Ezra", "Nehemiah", "Tobit", "Judith", "Esther", "Job", "Psalms?",
  "Proverbs", "Ecclesiastes", "Wisdom", "Sirach", "Isaiah", "Jeremiah", "Lamentations", "Baruch",
  "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
  "Zephaniah", "Haggai", "Zechariah", "Malachi", "Matthew", "Mark", "Luke", "John", "Acts", "Romans",
  "Galatians", "Ephesians", "Philippians", "Colossians", "Titus", "Philemon", "Hebrews", "James",
  "Jude", "Revelation", "Corinthians", "Timothy", "Thessalonians", "Peter", "Kings", "Samuel",
  "Maccabees", "Chronicles", "Matt", "Heb", "Eph", "Rev", "Ps", "Phil", "Rom", "Gal", "Col",
  "Deut", "Jas", "Cor", "Tim", "Thess", "Pet", "Sam", "Macc", "Chron",
  "Mt", "Mk", "Lk", "Jn", "Gen"];
var VERSE_BOOK_ALT = VERSE_BOOK_TOKENS.slice().sort(function (a, b) { return b.length - a.length; }).join("|");

function canonVerseBook(num, book) {
  if (VERSE_ALIASES[book]) book = VERSE_ALIASES[book];
  if (book === "Psalm") book = "Psalms";
  if (num) {
    if (["Corinthians", "Timothy", "Thessalonians", "Peter", "Kings", "Samuel", "Maccabees", "Chronicles", "John"].indexOf(book) !== -1) return num + " " + book;
    return null;
  }
  return book;
}

function parseVerseRef(ref) {
  ref = String(ref).trim();
  var m;
  if ((m = /^(Jude|Philemon|Obadiah)\s+(\d+)(?:\s*[-\u2013\u2014]\s*(\d+))?$/.exec(ref))) {
    return { book: m[1], segments: [{ ch: 1, v1: +m[2], v2: m[3] ? +m[3] : +m[2] }] };
  }
  if ((m = /^([23])\s+John\s+(\d+)(?:\s*[-\u2013\u2014]\s*(\d+))?$/.exec(ref))) {
    return { book: m[1] + " John", segments: [{ ch: 1, v1: +m[2], v2: m[3] ? +m[3] : +m[2] }] };
  }
  if (new RegExp("^(?:([123])\\s+)?(" + VERSE_BOOK_ALT + ")\\s+(\\d+)$").test(ref)) return null; // chapter-only
  var headRe = new RegExp("^(?:([123])\\s+)?(" + VERSE_BOOK_ALT + ")\\s+(\\d+):(\\d+)");
  m = headRe.exec(ref);
  if (!m) return null;
  var book = canonVerseBook(m[1], m[2]);
  if (!book) return null;
  var segments = [];
  var cur = { ch: +m[3], v1: +m[4], v2: +m[4] };
  var pos = m[0].length;
  var tailSep = /\s*(;(?=\s*\d+\s*:)|[,\u2013\u2014-])\s*/g;
  var tailOp = /(?:(\d+):)?(\d+)(?:\s*[-\u2013\u2014]\s*(?:(\d+):)?(\d+))?/g;
  while (pos < ref.length) {
    tailSep.lastIndex = pos;
    var sm = tailSep.exec(ref);
    if (!sm || sm.index !== pos) return null;
    var sep = sm[1];
    pos = tailSep.lastIndex;
    tailOp.lastIndex = pos;
    var om = tailOp.exec(ref);
    if (!om || om.index !== pos) return null;
    pos = tailOp.lastIndex;
    if (sep === "," || sep === ";") {
      segments.push(cur);
      cur = { ch: om[1] ? +om[1] : cur.ch, v1: +om[2], v2: om[4] ? +om[4] : +om[2] };
    } else {
      if (om[1]) {
        cur.v2 = null;
        segments.push(cur);
        cur = { ch: +om[1], v1: +om[2], v2: om[4] ? +om[4] : +om[2] };
      } else {
        cur.v2 = om[4] ? +om[4] : +om[2];
      }
    }
  }
  segments.push(cur);
  return { book: book, segments: segments };
}

function verseRefVerses(parsed) {
  var verses = window.VERSES;
  if (!verses || !parsed) return null;
  var out = [];
  for (var i = 0; i < parsed.segments.length; i++) {
    var s = parsed.segments[i];
    var v2 = s.v2;
    if (v2 === null) {
      var len = verses._xlengths && verses._xlengths[parsed.book] && verses._xlengths[parsed.book][s.ch];
      if (!len) return null;
      v2 = len;
    }
    for (var v = s.v1; v <= v2; v++) {
      var text = verses[parsed.book] && verses[parsed.book][s.ch] && verses[parsed.book][s.ch][v];
      if (text == null) return null;
      out.push({ book: parsed.book, ch: s.ch, v: v, text: text });
    }
  }
  return out.length ? out : null;
}

function linkVerseRefs(root) {
  var testRe = new RegExp("(?:([123])\\s+)?(" + VERSE_BOOK_ALT + ")\\s+\\d+:\\d+");
  var matchRe = new RegExp("\\b(?:([123])\\s+)?(" + VERSE_BOOK_ALT + ")\\s+\\d+:\\d+((?:\\s*(?:[,\\u2013\\u2014-]\\s*(?:\\d+:)?\\d+|;\\s*\\d+:\\d+)(?:\\s*[-\\u2013\\u2014]\\s*(?:\\d+:)?\\d+)?)*)", "g");
  linkVersePass(root, testRe, matchRe);
  // Bare single-chapter refs: "Jude 7", "Philemon 10", "2 John 3" (no colon).
  var bareTest = /\b(?:Jude|Philemon|Obadiah)\s+\d+(?:\s*[-\u2013\u2014]\s*\d+)?(?!:)|\b[23]\s+John\s+\d+(?:\s*[-\u2013\u2014]\s*\d+)?(?!:)/;
  var bareMatch = /\b(?:(Jude|Philemon|Obadiah)\s+(\d+)(?:\s*[-\u2013\u2014]\s*(\d+))?|([23])\s+John\s+(\d+)(?:\s*[-\u2013\u2014]\s*(\d+))?)(?!:)/g;
  linkVersePass(root, bareTest, bareMatch);
}

function linkVersePass(root, testRe, matchRe) {
  var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: function (node) {
      if (node.parentElement && node.parentElement.closest(".verse-ref, .ccc-ref, .gloss-term, .verse-list")) return NodeFilter.FILTER_REJECT;
      return testRe.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  var nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(function (node) {
    matchRe.lastIndex = 0;
    var frag = document.createDocumentFragment();
    var last = 0, m;
    var changed = false;
    while ((m = matchRe.exec(node.nodeValue))) {
      var parsed = parseVerseRef(m[0]);
      if (!parsed || !verseRefVerses(parsed)) continue;
      if (!changed) changed = true;
      frag.appendChild(document.createTextNode(node.nodeValue.slice(last, m.index)));
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "verse-ref";
      btn.setAttribute("data-verse", m[0]);
      btn.setAttribute("aria-label", "Read " + m[0] + " (CPDV)");
      btn.textContent = m[0];
      frag.appendChild(btn);
      last = m.index + m[0].length;
    }
    if (!changed) return;
    frag.appendChild(document.createTextNode(node.nodeValue.slice(last)));
    node.parentNode.replaceChild(frag, node);
  });
}

function openVerseModal(refText) {
  var parsed = parseVerseRef(refText);
  var list = parsed && verseRefVerses(parsed);
  var body = document.getElementById("verseModalBody");
  document.getElementById("verseModalTitle").textContent = refText + " · CPDV";
  body.innerHTML = "";
  if (!list) {
    var err = document.createElement("p");
    err.textContent = "Could not load this passage. Check your connection and try again.";
    body.appendChild(err);
  } else {
    list.forEach(function (it) {
      var p = document.createElement("p");
      if (list.length > 1) {
        var b = document.createElement("b");
        b.textContent = it.ch + ":" + it.v + " ";
        p.appendChild(b);
      }
      p.appendChild(document.createTextNode(it.text));
      body.appendChild(p);
    });
  }
  body.scrollTop = 0;
  document.getElementById("verseModalBackdrop").hidden = false;
  document.getElementById("verseModalClose").focus();
}

function closeVerseModal() {
  document.getElementById("verseModalBackdrop").hidden = true;
}

function renderSite(defenses) {
  var total = defenses.length;
  var track = document.getElementById("deckTrack");
  defenses.forEach(function (card, i) {
    var n = i + 1;
    var article = document.createElement("article");
    article.className = "entry";
    article.id = "answer-" + card.slug;
    article.setAttribute("data-entry", card.slug);
    article.setAttribute("data-card-index", String(i));
    article.setAttribute("aria-roledescription", "slide");
    article.setAttribute("aria-label", "Defense " + n + " of " + total);
    if (card.customBody) {
      article.innerHTML = card.customBody.split(" of 50").join(" of " + total);
    } else {
      article.innerHTML = renderStandardCard(card, n, total);
    }
    linkCccRefs(article);
    linkVerseRefs(article);
    track.appendChild(article);
  });
}

function initApp(defenses) {
        var TOPICS = ["God & Reason", "Scripture", "Jesus Christ", "The Church", "Mary & Saints", "Sacraments & Worship", "Moral Life", "Salvation & Last Things"];

        var topics = [];

        var activeFilter = "all";
        var grid = document.getElementById("topicGrid");
        var search = document.getElementById("search");
        var empty = document.getElementById("emptyState");
        var viewport = document.getElementById("defenseDeck");
        var track = document.getElementById("deckTrack");
        var cards = Array.prototype.slice.call(track.querySelectorAll(".entry"));
        var prevButton = document.getElementById("deckPrev");
        var nextButton = document.getElementById("deckNext");
        var deckProgress = document.getElementById("deckProgress");
        var deckProgressFill = document.getElementById("deckProgressFill");
        var deckCounter = document.getElementById("deckCounter");
        var currentCard = 0;
        var heroSearch = document.getElementById("heroSearch");
        var heroSearchResults = document.getElementById("heroSearchResults");
        var heroTopicChips = Array.prototype.slice.call(document.querySelectorAll(".topic-chip"));
        var heroMatches = [];
        /* Start-here path */
        var startSteps = document.getElementById("startSteps");
        var START_HERE = [
          { slug: "god-exists-evidence", label: "Does God exist?" },
          { slug: "jesus-divinity", label: "Is Jesus God?" },
          { slug: "resurrection-natural-explanations", label: "Did He really rise?" },
          { slug: "problem-of-evil", label: "Why does God allow suffering?" },
          { slug: "bible-contradictions", label: "Can I trust the Bible?" },
          { slug: "im-a-good-person", label: "Why do I need Jesus?" },
          { slug: "faith-alone", label: "Faith, works, and grace" },
          { slug: "eucharist", label: "The Eucharist" }
        ];
        if (startSteps) {
          START_HERE.forEach(function (step, k) {
            var li = document.createElement("li");
            var b = document.createElement("button");
            b.type = "button";
            b.className = "start-step";
            var n = document.createElement("span"); n.className = "start-num"; n.textContent = String(k + 1);
            var t = document.createElement("span"); t.className = "start-label"; t.textContent = step.label;
            b.appendChild(n); b.appendChild(t);
            b.setAttribute("aria-label", "Start here step " + (k + 1) + ": " + step.label);
            (function (stepNum) {
              b.addEventListener("click", function () { enterPathStep(stepNum); });
            })(k);
            li.appendChild(b);
            startSteps.appendChild(li);
          });
        }

        /* Essentials section: make its CCC references open the Catechism reader. */
        var essentials = document.getElementById("essentials");
        if (essentials) { linkCccRefs(essentials); }

        /* Guided path continuity: Step N of 8 banner inside the deck, with
           Next lesson / Back to the path, and Simply-put entry. Any other
           deck navigation leaves the path (see showCard). */
        var activePathStep = -1;
        var pathComplete = false;
        var pathBanner = document.getElementById("pathBanner");
        function exitPath() {
          activePathStep = -1;
          pathComplete = false;
          if (pathBanner) pathBanner.hidden = true;
        }
        function finishPath() {
          pathComplete = true;
          renderPathBanner();
          var feat = document.getElementById("featured-answer");
          if (feat) scrollToEl(feat);
        }
        function renderPathBanner() {
          if (!pathBanner) return;
          if (pathComplete) {
            pathBanner.innerHTML = "";
            var doneHead = document.createElement("div");
            doneHead.className = "path-banner-head";
            var doneStep = document.createElement("span");
            doneStep.className = "path-banner-step";
            doneStep.textContent = "Guided path · Complete";
            var doneTitle = document.createElement("span");
            doneTitle.className = "path-banner-title";
            doneTitle.textContent = "You've finished the path — eight defenses, done. Where next?";
            doneHead.appendChild(doneStep);
            doneHead.appendChild(doneTitle);
            var doneActions = document.createElement("div");
            doneActions.className = "path-banner-actions";
            function doneButton(label, targetId, cls) {
              var b = document.createElement("button");
              b.type = "button";
              b.className = "path-banner-btn " + (cls || "");
              b.textContent = label;
              b.addEventListener("click", function () {
                exitPath();
                var t = document.getElementById(targetId);
                if (t) scrollToEl(t);
              });
              return b;
            }
            doneActions.appendChild(doneButton("Browse by topic", "completed-index", "path-complete-browse"));
            doneActions.appendChild(doneButton("Pocket Armory", "pocket", "path-complete-pocket"));
            doneActions.appendChild(doneButton("Back to the path", "start-here", "path-complete-back"));
            pathBanner.appendChild(doneHead);
            pathBanner.appendChild(doneActions);
            pathBanner.hidden = false;
            return;
          }
          if (activePathStep < 0) return;
          var step = START_HERE[activePathStep];
          var last = activePathStep === START_HERE.length - 1;
          pathBanner.innerHTML = "";
          var head = document.createElement("div");
          head.className = "path-banner-head";
          var stepEl = document.createElement("span");
          stepEl.className = "path-banner-step";
          stepEl.textContent = "Guided path · Step " + (activePathStep + 1) + " of " + START_HERE.length;
          var titleEl = document.createElement("span");
          titleEl.className = "path-banner-title";
          titleEl.textContent = step.label;
          head.appendChild(stepEl);
          head.appendChild(titleEl);
          var actions = document.createElement("div");
          actions.className = "path-banner-actions";
          var back = document.createElement("button");
          back.type = "button";
          back.className = "path-banner-btn";
          back.textContent = "← Back to the path";
          back.addEventListener("click", function () {
            var startHere = document.getElementById("start-here");
            if (startHere) scrollToEl(startHere);
          });
          var next = document.createElement("button");
          next.type = "button";
          next.className = "path-banner-btn path-banner-next";
          next.textContent = last ? "Finish the path →" : "Next lesson →";
          next.addEventListener("click", function () {
            if (last) finishPath();
            else enterPathStep(activePathStep + 1);
          });
          var leave = document.createElement("button");
          leave.type = "button";
          leave.className = "path-banner-btn path-banner-leave";
          leave.textContent = "✕ Leave the path";
          leave.setAttribute("aria-label", "Leave the guided path");
          leave.addEventListener("click", exitPath);
          actions.appendChild(back);
          actions.appendChild(next);
          actions.appendChild(leave);
          pathBanner.appendChild(head);
          pathBanner.appendChild(actions);
          pathBanner.hidden = false;
        }
        function enterPathStep(k) {
          activePathStep = k;
          pathComplete = false;
          var idx = defenses.findIndex(function (d) { return d.slug === START_HERE[k].slug; });
          if (idx >= 0) {
            showCard(idx, { scroll: true, pathStep: k });
            var cardEl = cards[idx];
            var simpleTab = cardEl ? cardEl.querySelector('[data-panel="simple"]') : null;
            if (simpleTab) simpleTab.click();
          }
          renderPathBanner();
        }

        /* Pocket armory */
        var pocketList = document.getElementById("pocketList");
        var pocketSearch = document.getElementById("pocketSearch");
        function pocketCopy(text, btn) {
          var original = btn.textContent;
          function done() {
            btn.textContent = "\u2713 Copied!";
            window.setTimeout(function () { btn.textContent = original; }, 1600);
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(done, done);
          } else { done(); }
        }
        function pocketItem(card, index) {
          var item = document.createElement("div");
          item.className = "pocket-item";
          var quote = document.createElement("p");
          quote.className = "pocket-quote";
          quote.innerHTML = linkGlossaryTerms(escapeHtml(card.oneLiner));
          var meta = document.createElement("div");
          meta.className = "pocket-meta";
          var open = document.createElement("button");
          open.type = "button";
          open.className = "pocket-open";
          open.textContent = card.title;
          open.setAttribute("aria-label", "Open the full defense: " + card.title);
          var copy = document.createElement("button");
          copy.type = "button";
          copy.className = "pocket-copy";
          copy.textContent = "Copy";
          copy.setAttribute("aria-label", "Copy one-liner for: " + card.title);
          (function (idx, txt, btn) {
            open.addEventListener("click", function () { showCard(idx, { scroll: true }); });
            copy.addEventListener("click", function () { pocketCopy(txt, btn); });
          })(index, card.oneLiner + "\n\n— Christian Armory: " + window.location.origin + window.location.pathname + "#answer-" + card.slug, copy);
          meta.appendChild(open);
          meta.appendChild(copy);
          item.appendChild(quote);
          item.appendChild(meta);
          return item;
        }
        function renderPocket() {
          if (!pocketList) return;
          var q = pocketSearch ? pocketSearch.value.trim().toLowerCase() : "";
          pocketList.innerHTML = "";
          var anyShown = false;
          TOPICS.forEach(function (t) {
            var items = [];
            defenses.forEach(function (card, i) {
              if (card.topic !== t) return;
              var hay = (card.oneLiner + " " + card.title + " " + card.jumpLabel).toLowerCase();
              if (q && hay.indexOf(q) < 0) return;
              items.push({ card: card, index: i });
            });
            if (!items.length) return;
            anyShown = true;
            var det = document.createElement("details");
            det.className = "pocket-group";
            if (q) det.setAttribute("open", "");
            var sum = document.createElement("summary");
            sum.className = "pocket-summary";
            var st = document.createElement("span"); st.textContent = t;
            var sc = document.createElement("span"); sc.className = "browse-count"; sc.textContent = String(items.length);
            sum.appendChild(st); sum.appendChild(sc);
            det.appendChild(sum);
            items.forEach(function (it) { det.appendChild(pocketItem(it.card, it.index)); });
            pocketList.appendChild(det);
          });
          if (!anyShown) {
            var empty = document.createElement("p");
            empty.className = "pocket-empty";
            empty.textContent = "No one-liners match that search.";
            pocketList.appendChild(empty);
          }
        }
        if (pocketSearch) pocketSearch.addEventListener("input", renderPocket);
        renderPocket();

        /* My Armory: saved defenses, persisted per device. */
        var myArmoryList = document.getElementById("myArmoryList");
        var myArmoryCount = document.getElementById("myArmoryCount");
        function refreshBookmarkButton(slug) {
          var btn = document.querySelector('.entry[data-entry="' + slug + '"] [data-bookmark]');
          if (!btn) return;
          var saved = isBookmarked(slug);
          btn.setAttribute("aria-pressed", saved ? "true" : "false");
          btn.textContent = saved ? "★ Saved to My Armory" : "☆ Save to My Armory";
        }
        function renderMyArmory() {
          if (!myArmoryList) return;
          var saved = loadBookmarks();
          var entries = [];
          saved.forEach(function (slug) {
            var idx = defenses.findIndex(function (d) { return d.slug === slug; });
            if (idx >= 0) entries.push({ card: defenses[idx], index: idx });
          });
          if (entries.length !== saved.length) saveBookmarks(entries.map(function (e) { return e.card.slug; }));
          if (myArmoryCount) myArmoryCount.textContent = entries.length ? "(" + entries.length + ")" : "";
          myArmoryList.innerHTML = "";
          if (!entries.length) {
            var empty = document.createElement("p");
            empty.className = "my-armory-empty";
            empty.textContent = "No saved defenses yet — tap ☆ Save to My Armory on any defense to keep it here.";
            myArmoryList.appendChild(empty);
            return;
          }
          entries.forEach(function (e) {
            var row = document.createElement("div");
            row.className = "my-armory-item";
            var num = document.createElement("span"); num.className = "my-armory-num"; num.textContent = pad2(e.index + 1);
            var title = document.createElement("button");
            title.type = "button"; title.className = "my-armory-title";
            title.textContent = e.card.title;
            title.setAttribute("aria-label", "Open defense " + (e.index + 1) + ": " + e.card.title);
            title.addEventListener("click", function () { showCard(e.index, { scroll: true }); });
            var remove = document.createElement("button");
            remove.type = "button"; remove.className = "my-armory-remove";
            remove.textContent = "Remove";
            remove.setAttribute("aria-label", "Remove from My Armory: " + e.card.title);
            remove.addEventListener("click", function () {
              toggleBookmark(e.card.slug);
              refreshBookmarkButton(e.card.slug);
              renderMyArmory();
            });
            row.appendChild(num); row.appendChild(title); row.appendChild(remove);
            myArmoryList.appendChild(row);
          });
        }
        renderMyArmory();

        /* Study-group handout: one-liners for one topic, generated from
           the same card data so it can never drift from the live deck. */
        var handoutTopic = document.getElementById("handoutTopic");
        var handoutDoc = document.getElementById("handoutDoc");
        var handoutPrint = document.getElementById("handoutPrint");
        var handoutParamMode = false;
        function renderHandout() {
          if (!handoutTopic || !handoutDoc) return;
          var topic = handoutTopic.value;
          var items = [];
          defenses.forEach(function (d, i) {
            if (topic === "all" || d.topic === topic) items.push({ card: d, index: i });
          });
          handoutDoc.innerHTML = "";
          var hTitle = document.createElement("h3");
          hTitle.className = "handout-doc-title";
          hTitle.textContent = "Christian Armory — Pocket Handout";
          var hTopic = document.createElement("p");
          hTopic.className = "handout-doc-topic";
          hTopic.textContent = topic === "all" ? "All topics · " + items.length + " one-liners" : topic + " · " + items.length + " one-liners";
          var hNote = document.createElement("p");
          hNote.className = "handout-doc-note";
          hNote.textContent = "A field guide, not the final word. For deeper questions, speak with your parish priest.";
          var list = document.createElement("ol");
          list.className = "handout-doc-list";
          items.forEach(function (it) {
            var li = document.createElement("li");
            var num = document.createElement("span");
            num.className = "handout-doc-num";
            num.textContent = "#" + (it.index + 1);
            var title = document.createElement("strong");
            title.textContent = it.card.title;
            var quote = document.createElement("span");
            quote.textContent = " — " + it.card.oneLiner;
            li.appendChild(num);
            li.appendChild(title);
            li.appendChild(quote);
            list.appendChild(li);
          });
          var foot = document.createElement("p");
          foot.className = "handout-doc-foot";
          foot.textContent = "christianarmory.org · Free for everyone, always.";
          handoutDoc.appendChild(hTitle);
          handoutDoc.appendChild(hTopic);
          handoutDoc.appendChild(hNote);
          handoutDoc.appendChild(list);
          handoutDoc.appendChild(foot);
          if (handoutParamMode) {
            var exitBtn = document.createElement("button");
            exitBtn.type = "button";
            exitBtn.className = "support-btn handout-exit";
            exitBtn.textContent = "← Back to the full site";
            exitBtn.addEventListener("click", function () {
              handoutParamMode = false;
              document.body.classList.remove("print-handout");
              renderHandout();
            });
            handoutDoc.insertBefore(exitBtn, handoutDoc.firstChild);
          }
        }
        if (handoutTopic && handoutDoc) {
          var allOpt = document.createElement("option");
          allOpt.value = "all";
          allOpt.textContent = "All topics";
          handoutTopic.appendChild(allOpt);
          TOPICS.forEach(function (t) {
            var opt = document.createElement("option");
            opt.value = t;
            opt.textContent = t;
            handoutTopic.appendChild(opt);
          });
          handoutTopic.addEventListener("change", renderHandout);
          /* Default to the first topic (God & Reason, 20 one-liners) so the
             page doesn't render all 125 on every load. "All topics" stays
             in the dropdown; a ?handout= param below still overrides this. */
          handoutTopic.value = TOPICS[0];
          renderHandout();
          /* ?handout=<topic|all> deep link: show just the handout, ready to
             print — a shareable link for study-group leaders. */
          var handoutParam = null;
          try { handoutParam = new URLSearchParams(window.location.search).get("handout"); } catch (e) {}
          if (handoutParam && (handoutParam === "all" || TOPICS.indexOf(handoutParam) !== -1)) {
            handoutParamMode = true;
            handoutTopic.value = handoutParam;
            renderHandout();
            document.body.classList.add("print-handout");
            var handoutSection = document.getElementById("handout");
            if (handoutSection) scrollToEl(handoutSection);
          }
        }
        if (handoutPrint) {
          handoutPrint.addEventListener("click", function () {
            document.body.classList.add("print-handout");
            window.print();
          });
          window.addEventListener("afterprint", function () {
            handoutParamMode = false;
            document.body.classList.remove("print-handout");
          });
        }

        /* Seven sacraments carousel */
        var SACRAMENTS = [
          { icon: "\uD83D\uDCA7", name: "Baptism", tag: "The door",
            text: "The first sacrament: original sin washed away, rebirth as a child of God, entry into the Church. This is why Catholics baptize infants \u2014 grace comes before understanding.",
            verse: "John 3:5", ccc: "CCC 1213", defenses: ["infant-baptism", "thief-on-the-cross"] },
          { icon: "\uD83D\uDD4A\uFE0F", name: "Confirmation", tag: "The seal",
            text: "The Holy Spirit's strengthening for witness \u2014 Pentecost made personal. Sealed with chrism, the confirmed are armed to profess the faith boldly, as the apostles did.",
            verse: "Acts 2:38", ccc: "CCC 1285", defenses: ["confirmation-unbiblical"] },
          { icon: "\uD83C\uDF5E", name: "Eucharist", tag: "The source and summit",
            text: "Christ's Body and Blood under the signs of bread and wine \u2014 the one sacrifice of the cross made present, and food for the journey. The source and summit of the Christian life.",
            verse: "John 6:56", ccc: "CCC 1324", defenses: ["eucharist", "mass-re-sacrifice"] },
          { icon: "\uD83D\uDE4F", name: "Penance", tag: "The second plank",
            text: "Confession to a priest: sins forgiven by Christ's own commission \u2014 \u2018whose sins you forgive are forgiven.\u2019 The second plank after the shipwreck of post-baptismal sin.",
            verse: "John 20:23", ccc: "CCC 1422", defenses: ["confession"] },
          { icon: "\uD83D\uDD6F\uFE0F", name: "Anointing of the Sick", tag: "Strength for the suffering",
            text: "Oil and prayer for the seriously ill and the dying \u2014 grace for endurance, the forgiveness of sins, and, when God wills, healing of the body. Not \u2018last rites\u2019 only.",
            verse: "James 5:14-15", ccc: "CCC 1511", defenses: ["anointing-of-the-sick"] },
          { icon: "\uD83D\uDC92", name: "Matrimony", tag: "The covenant",
            text: "A man and woman's lifelong covenant, imaging Christ's love for the Church \u2014 and the ordinary path by which most saints are made: the domestic church.",
            verse: "Ephesians 5:31-32", ccc: "CCC 1601", defenses: ["annulments"] },
          { icon: "\u271D\uFE0F", name: "Holy Orders", tag: "The servant priesthood",
            text: "Bishops, priests, and deacons configured to Christ the Head \u2014 to preach, sanctify, and govern. The sacrament standing behind every Mass and every absolution.",
            verse: "2 Timothy 1:6", ccc: "CCC 1536", defenses: ["apostolic-succession", "priestly-celibacy"] }
        ];
        (function () {
          var track = document.getElementById("sacramentsTrack");
          var dotsWrap = document.getElementById("sacramentsDots");
          var counter = document.getElementById("sacramentsCounter");
          var prev = document.getElementById("sacramentsPrev");
          var next = document.getElementById("sacramentsNext");
          var viewport = document.getElementById("sacramentsViewport");
          if (!track) return;
          SACRAMENTS.forEach(function (s, i) {
            var slide = document.createElement("article");
            slide.className = "sacrament-slide";
            slide.setAttribute("aria-hidden", i === 0 ? "false" : "true");
            if (i !== 0) slide.setAttribute("inert", "");
            var icon = document.createElement("div"); icon.className = "sacrament-icon"; icon.textContent = s.icon; icon.setAttribute("aria-hidden", "true");
            var tag = document.createElement("p"); tag.className = "sacrament-tag"; tag.textContent = s.tag;
            var h = document.createElement("h3"); h.textContent = s.name;
            var p = document.createElement("p"); p.textContent = s.text;
            var refs = document.createElement("div"); refs.className = "sacrament-refs";
            var v;
            if (verseRefVerses(parseVerseRef(s.verse))) {
              v = document.createElement("button"); v.type = "button"; v.className = "verse-ref";
              v.setAttribute("data-verse", s.verse);
              v.setAttribute("aria-label", "Read " + s.verse + " (CPDV)");
              v.textContent = s.verse;
            } else {
              v = document.createElement("span"); v.textContent = s.verse;
            }
            var cccNum = s.ccc.replace(/\D/g, "");
            var c = document.createElement("button"); c.type = "button"; c.className = "ccc-ref";
            c.textContent = s.ccc; c.setAttribute("data-ccc", cccNum);
            c.setAttribute("aria-label", "Read Catechism paragraph " + cccNum);
            refs.appendChild(v); refs.appendChild(c);
            slide.appendChild(icon); slide.appendChild(tag); slide.appendChild(h); slide.appendChild(p); slide.appendChild(refs);
            if (s.defenses && s.defenses.length) {
              var links = document.createElement("div"); links.className = "sacrament-defenses";
              var lab = document.createElement("p"); lab.textContent = "Defended in the armory";
              links.appendChild(lab);
              s.defenses.forEach(function (slug) {
                var idx = defenses.findIndex(function (d) { return d.slug === slug; });
                if (idx < 0) return;
                var b = document.createElement("button");
                b.type = "button";
                b.textContent = defenses[idx].title + " \u2192";
                b.setAttribute("aria-label", "Open the defense: " + defenses[idx].title);
                b.addEventListener("click", function () { showCard(idx, { scroll: true }); });
                links.appendChild(b);
              });
              slide.appendChild(links);
            }
            track.appendChild(slide);
          });
          var slides = Array.prototype.slice.call(track.children);
          var current = 0;
          function showSacrament(index, scroll) {
            current = Math.max(0, Math.min(slides.length - 1, index));
            slides.forEach(function (slide, si) {
              var active = si === current;
              slide.setAttribute("aria-hidden", active ? "false" : "true");
              if (active) slide.removeAttribute("inert"); else slide.setAttribute("inert", "");
            });
            if (dotsWrap) {
              Array.prototype.slice.call(dotsWrap.children).forEach(function (dot, di) {
                dot.setAttribute("aria-current", di === current ? "true" : "false");
              });
            }
            if (prev) prev.disabled = current === 0;
            if (next) next.disabled = current === slides.length - 1;
            if (counter) counter.textContent = "Sacrament " + (current + 1) + " of " + slides.length;
            if (scroll && viewport) scrollToEl(viewport);
          }
          if (dotsWrap) {
            slides.forEach(function (slide, i) {
              var dot = document.createElement("button");
              dot.type = "button";
              dot.className = "deck-dot";
              dot.setAttribute("aria-label", "Show sacrament " + (i + 1) + ": " + SACRAMENTS[i].name);
              dot.setAttribute("aria-current", i === 0 ? "true" : "false");
              dot.addEventListener("click", function () { showSacrament(i); });
              dotsWrap.appendChild(dot);
            });
          }
          if (prev) prev.addEventListener("click", function () { showSacrament(current - 1); });
          if (next) next.addEventListener("click", function () { showSacrament(current + 1); });
          if (viewport) {
            viewport.addEventListener("keydown", function (event) {
              if (event.target !== viewport) return;
              if (event.key === "ArrowLeft") { event.preventDefault(); showSacrament(current - 1); }
              if (event.key === "ArrowRight") { event.preventDefault(); showSacrament(current + 1); }
            });
            var sx = 0, sy = 0, strack = false;
            viewport.addEventListener("touchstart", function (event) {
              if (event.touches.length !== 1) return;
              sx = event.touches[0].clientX; sy = event.touches[0].clientY; strack = true;
            }, { passive: true });
            viewport.addEventListener("touchend", function (event) {
              if (!strack || !event.changedTouches.length) return;
              strack = false;
              var dx = event.changedTouches[0].clientX - sx;
              var dy = event.changedTouches[0].clientY - sy;
              if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) showSacrament(current + (dx < 0 ? 1 : -1));
            }, { passive: true });
          }
          showSacrament(0);
        })();


var topicCarousels = document.getElementById("topicCarousels");

        function buildTopicCarousel(topic, items) {
          var wrap = document.createElement("section");
          wrap.className = "topic-carousel";
          wrap.setAttribute("aria-label", topic + " defenses");
          var head = document.createElement("div");
          head.className = "topic-carousel-head";
          var h = document.createElement("h3"); h.textContent = topic;
          var count = document.createElement("span"); count.className = "tcount";
          count.textContent = items.length + " defenses";
          var headRight = document.createElement("span"); headRight.className = "topic-head-right";
          var listToggle = document.createElement("button");
          listToggle.type = "button"; listToggle.className = "topic-toggle";
          listToggle.setAttribute("aria-expanded", "false");
          listToggle.textContent = "Show all titles";
          headRight.appendChild(count); headRight.appendChild(listToggle);
          head.appendChild(h); head.appendChild(headRight);
          var controls = document.createElement("div");
          controls.className = "deck-controls";
          controls.setAttribute("aria-label", topic + " carousel controls");
          var prev = document.createElement("button");
          prev.type = "button"; prev.className = "deck-arrow"; prev.innerHTML = "&larr;";
          prev.setAttribute("aria-label", "Previous defense in " + topic);
          var pos = document.createElement("div"); pos.className = "deck-position";
          var counter = document.createElement("span"); counter.setAttribute("aria-live", "polite");
          var dots = document.createElement("div"); dots.className = "deck-dots";
          pos.appendChild(counter); pos.appendChild(dots);
          var next = document.createElement("button");
          next.type = "button"; next.className = "deck-arrow"; next.innerHTML = "&rarr;";
          next.setAttribute("aria-label", "Next defense in " + topic);
          controls.appendChild(prev); controls.appendChild(pos); controls.appendChild(next);
          var viewport = document.createElement("div");
          viewport.className = "topic-viewport";
          viewport.setAttribute("role", "region");
          viewport.setAttribute("tabindex", "0");
          viewport.setAttribute("aria-roledescription", "carousel");
          viewport.setAttribute("aria-label", topic);
          var track = document.createElement("div");
          track.className = "topic-track";
          items.forEach(function (it) {
            var b = document.createElement("button");
            b.type = "button"; b.className = "topic-slide";
            b.setAttribute("aria-hidden", "true"); b.setAttribute("inert", "");
            var num = document.createElement("span"); num.className = "topic-num"; num.textContent = pad2(it.index + 1);
            var title = document.createElement("span"); title.className = "topic-title"; title.textContent = it.card.jumpLabel;
            b.appendChild(num); b.appendChild(title);
            if (it.card.level) {
              var lv = document.createElement("span"); lv.className = "topic-level level-" + it.card.level;
              lv.textContent = levelLabel(it.card.level);
              b.appendChild(lv);
            }
            b.setAttribute("aria-label", "Open defense " + (it.index + 1) + ": " + it.card.jumpLabel);
            b.addEventListener("click", function () { showCard(it.index, { scroll: true }); });
            track.appendChild(b);
          });
          viewport.appendChild(track);
          /* List view: every title in this topic, one tap to open. Toggling
             swaps the carousel (viewport + controls) for the list. */
          var allList = document.createElement("ul");
          allList.className = "topic-all";
          items.forEach(function (it) {
            var li = document.createElement("li");
            var tb = document.createElement("button");
            tb.type = "button"; tb.className = "topic-all-title";
            var tnum = document.createElement("span"); tnum.className = "topic-num"; tnum.textContent = pad2(it.index + 1);
            var ttitle = document.createElement("span"); ttitle.className = "topic-title"; ttitle.textContent = it.card.jumpLabel;
            tb.appendChild(tnum); tb.appendChild(ttitle);
            tb.setAttribute("aria-label", "Open defense " + (it.index + 1) + ": " + it.card.jumpLabel);
            tb.addEventListener("click", function () { showCard(it.index, { scroll: true }); });
            li.appendChild(tb); allList.appendChild(li);
          });
          listToggle.addEventListener("click", function () {
            var expanded = !wrap.classList.contains("is-list-view");
            wrap.classList.toggle("is-list-view", expanded);
            listToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
            listToggle.textContent = expanded ? "Show carousel" : "Show all titles";
          });
          wrap.appendChild(head); wrap.appendChild(controls); wrap.appendChild(viewport); wrap.appendChild(allList);
          topicCarousels.appendChild(wrap);
          var slides = Array.prototype.slice.call(track.children);
          var current = 0;
          slides.forEach(function (s, i) {
            var d = document.createElement("button");
            d.type = "button"; d.className = "deck-dot";
            d.setAttribute("aria-label", "Show defense " + (i + 1) + " of " + slides.length + " in " + topic);
            d.addEventListener("click", function () { show(i); });
            dots.appendChild(d);
          });
          var dotEls = Array.prototype.slice.call(dots.children);
          function show(i) {
            current = Math.max(0, Math.min(slides.length - 1, i));
            slides.forEach(function (s, si) {
              var active = si === current;
              s.setAttribute("aria-hidden", active ? "false" : "true");
              if (active) s.removeAttribute("inert"); else s.setAttribute("inert", "");
            });
            dotEls.forEach(function (d, di) { d.setAttribute("aria-current", di === current ? "true" : "false"); });
            prev.disabled = current === 0;
            next.disabled = current === slides.length - 1;
            counter.textContent = (current + 1) + " of " + slides.length;
          }
          prev.addEventListener("click", function () { show(current - 1); });
          next.addEventListener("click", function () { show(current + 1); });
          viewport.addEventListener("keydown", function (e) {
            if (e.target !== viewport) return;
            if (e.key === "ArrowLeft") { e.preventDefault(); show(current - 1); }
            if (e.key === "ArrowRight") { e.preventDefault(); show(current + 1); }
          });
          var sx = 0, sy = 0, st = false;
          viewport.addEventListener("touchstart", function (e) {
            if (e.touches.length !== 1) return;
            sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = true;
          }, { passive: true });
          viewport.addEventListener("touchend", function (e) {
            if (!st || !e.changedTouches.length) return;
            st = false;
            var dx = e.changedTouches[0].clientX - sx;
            var dy = e.changedTouches[0].clientY - sy;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) show(current + (dx < 0 ? 1 : -1));
          }, { passive: true });
          show(0);
        }

        TOPICS.forEach(function (t) {
          var items = [];
          defenses.forEach(function (card, i) { if (card.topic === t) items.push({ card: card, index: i }); });
          if (items.length) buildTopicCarousel(t, items);
        });

        if (deckProgress) deckProgress.setAttribute("aria-valuemax", String(cards.length));

        function updateDeckHeight() {
          viewport.style.height = "auto";
        }

        var readingBtn = null;
        function stripTagsForSpeech(html) {
          var d = document.createElement("div");
          d.innerHTML = html;
          return d.textContent || "";
        }
        function setReadingBtn(btn) {
          if (readingBtn && readingBtn !== btn) readingBtn.textContent = "🔊 Listen";
          readingBtn = btn;
        }
        function stopReading() {
          if ("speechSynthesis" in window) window.speechSynthesis.cancel();
          setReadingBtn(null);
        }
        function toggleReadAloud(card, btn) {
          if (!("speechSynthesis" in window)) return;
          var synth = window.speechSynthesis;
          if (readingBtn === btn && synth.speaking) { stopReading(); return; }
          stopReading();
          var text = card.title + ". " + card.oneLiner + " " +
            stripTagsForSpeech(card.summary) + " " +
            card.response.map(function (p) { return p.heading + ". " + stripTagsForSpeech(p.body); }).join(" ");
          var u = new SpeechSynthesisUtterance(text);
          u.onend = function () { setReadingBtn(null); };
          u.onerror = function () { setReadingBtn(null); };
          btn.textContent = "\u23F9 Stop";
          setReadingBtn(btn);
          synth.speak(u);
        }
        function showCard(index, options) {
          options = options || {};
          if (options.pathStep === undefined && activePathStep >= 0) exitPath();
          stopReading();
          currentCard = Math.max(0, Math.min(cards.length - 1, index));
          track.style.transform = "translateX(-" + (currentCard * 100) + "%)";
          cards.forEach(function (card, cardIndex) {
            var isActive = cardIndex === currentCard;
            card.setAttribute("aria-hidden", isActive ? "false" : "true");
            if (isActive) card.removeAttribute("inert");
            else card.setAttribute("inert", "");
          });
          if (deckProgressFill) deckProgressFill.style.width = ((currentCard + 1) / cards.length * 100) + "%";
          if (deckProgress) deckProgress.setAttribute("aria-valuenow", String(currentCard + 1));
          prevButton.disabled = currentCard === 0;
          nextButton.disabled = currentCard === cards.length - 1;
          deckCounter.textContent = "Defense " + (currentCard + 1) + " of " + cards.length;
          window.requestAnimationFrame(updateDeckHeight);
          if (options.updateHash !== false && window.history && window.history.replaceState) {
            window.history.replaceState(null, "", "#" + cards[currentCard].id);
          }
          if (options.scroll) scrollToEl(viewport);
        }

        var ASK_CONTRACTIONS = {
          "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not",
          "don't": "do not", "doesn't": "does not", "didn't": "did not",
          "can't": "cannot", "couldn't": "could not", "won't": "will not", "wouldn't": "would not",
          "shouldn't": "should not", "hasn't": "has not", "haven't": "have not", "hadn't": "had not",
          "what's": "what is", "it's": "it is", "that's": "that is", "there's": "there is",
          "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are",
          "who's": "who is", "where's": "where is", "let's": "let us"
        };
        var ASK_STOPWORDS = { "is": 1, "are": 1, "am": 1, "was": 1, "were": 1, "be": 1, "been": 1, "being": 1, "the": 1, "a": 1, "an": 1, "of": 1, "to": 1, "in": 1, "on": 1, "and": 1, "or": 1, "for": 1, "with": 1, "how": 1, "what": 1, "why": 1, "when": 1, "where": 1, "who": 1, "whom": 1, "whose": 1, "which": 1, "do": 1, "does": 1, "did": 1, "can": 1, "could": 1, "should": 1, "would": 1, "will": 1, "shall": 1, "may": 1, "might": 1, "must": 1, "i": 1, "you": 1, "he": 1, "she": 1, "it": 1, "they": 1, "we": 1, "me": 1, "him": 1, "them": 1, "us": 1, "my": 1, "your": 1, "his": 1, "its": 1, "their": 1, "our": 1, "this": 1, "that": 1, "these": 1, "those": 1, "as": 1, "at": 1, "by": 1, "from": 1, "about": 1, "into": 1, "over": 1, "after": 1, "before": 1, "if": 1, "then": 1, "than": 1, "so": 1, "such": 1, "just": 1, "really": 1, "very": 1, "much": 1, "more": 1, "most": 1, "some": 1, "any": 1, "there": 1, "here": 1, "but": 1, "go": 1, "going": 1, "get": 1, "got": 1, "like": 1, "know": 1, "think": 1, "feel": 1, "want": 1, "need": 1, "see": 1, "say": 1, "told": 1, "common": 1, "objection": 1 };

        function expandAskContractions(text) {
          return text.split(/\s+/).map(function (w) { return ASK_CONTRACTIONS[w] || w; }).join(" ");
        }

        function normalizeSearchText(value) {
          return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’‘]/g, "'");
        }

        /* One-edit distance (insertion, deletion, substitution, or an adjacent
           transposition) — typo tolerance for search. Short words are
           excluded: one edit is too much of a 3-letter word. */
        function withinOneEdit(a, b) {
          if (a === b) return true;
          var la = a.length, lb = b.length;
          if (Math.abs(la - lb) > 1) return false;
          if (Math.min(la, lb) < 4) return false;
          if (la === lb) {
            var diffs = 0, first = -1;
            for (var i = 0; i < la; i++) {
              if (a[i] !== b[i]) { diffs++; if (first === -1) first = i; }
              if (diffs > 2) return false;
            }
            if (diffs === 1) return true;
            if (diffs === 2 && first + 1 < la && a[first] === b[first + 1] && a[first + 1] === b[first]) return true;
            return false;
          }
          var short = la < lb ? a : b, long = la < lb ? b : a;
          var i = 0, j = 0, skipped = false;
          while (i < short.length && j < long.length) {
            if (short[i] === long[j]) { i++; j++; }
            else if (!skipped) { skipped = true; j++; }
            else return false;
          }
          return true;
        }

        /* Synonyms: everyday words people type -> the vocabulary the cards use.
           Expanded words are ADDED to the query (the original word still scores),
           so "gay" also matches "homosexuality" and "same-sex". */
        var ASK_SYNONYMS = {
          "gay": ["homosexuality", "same-sex"], "lesbian": ["homosexuality", "same-sex"],
          "bisexual": ["homosexuality", "same-sex"], "lgbt": ["homosexuality", "same-sex"],
          "lgbtq": ["homosexuality", "same-sex"], "queer": ["homosexuality", "same-sex"],
          "homosexual": ["homosexuality", "same-sex"],
          "saved": ["salvation"], "salvation": ["saved"],
          "communion": ["eucharist"], "host": ["eucharist"], "wafer": ["eucharist"],
          "pope": ["papacy"], "papacy": ["pope"],
          "bible": ["scripture"], "scripture": ["bible"],
          "confess": ["confession"], "confession": ["confess"],
          "baptism": ["baptized"], "baptized": ["baptism"],
          "cross": ["crucifixion"], "crucifixion": ["cross"],
          "resurrection": ["risen"], "risen": ["resurrection"],
          "witness": ["jehovah"], "witnesses": ["jehovah"], "jehovah": ["witness"],
          "jw": ["jehovah", "witness"],
          "muslim": ["islam"], "islam": ["muslim"], "quran": ["islam"],
          "atheist": ["atheism"], "atheism": ["atheist"],
          "porn": ["pornography"], "pornography": ["porn"],
          "heaven": ["paradise"], "paradise": ["heaven"],
          "soul": ["immortal"], "immortal": ["soul"],
          "priest": ["priesthood"], "priesthood": ["priest"],
          "celibacy": ["celibate"], "celibate": ["celibacy"],
          "saints": ["intercession"], "intercession": ["saints"],
          "trinity": ["triune"], "triune": ["trinity"]
        };

        /* Phrases: an exact phrase is a strong intent signal — it outranks a lone
           title word. Each phrase maps to exactly one card (+4). Deliberately NOT
           included: "am i saved" — it is ambiguous, and the words must decide. */
        var ASK_PHRASES = [
          { phrase: "body of christ", slug: "eucharist" },
          { phrase: "bread and wine", slug: "eucharist" },
          { phrase: "real presence", slug: "eucharist" },
          { phrase: "blood of christ", slug: "eucharist" },
          { phrase: "i am gay", slug: "church-homosexuality" },
          { phrase: "i am lesbian", slug: "church-homosexuality" },
          { phrase: "i am bisexual", slug: "church-homosexuality" },
          { phrase: "going to hell", slug: "hell-unjust" },
          { phrase: "go to hell", slug: "hell-unjust" },
          { phrase: "once saved always saved", slug: "once-saved-always-saved" },
          { phrase: "call no man father", slug: "call-no-man-father" },
          { phrase: "144,000", slug: "only-144000-heaven" },
          { phrase: "144000", slug: "only-144000-heaven" },
          { phrase: "soul sleep", slug: "soul-sleep" },
          { phrase: "great apostasy", slug: "great-apostasy-babylon" },
          { phrase: "pray to saints", slug: "saints-necromancy" },
          { phrase: "praying to saints", slug: "saints-necromancy" },
          { phrase: "worship mary", slug: "catholics-worship-mary" },
          { phrase: "book of mormon", slug: "mormonism" },
          { phrase: "only catholics", slug: "only-catholics-heaven" },
          { phrase: "dead are unconscious", slug: "soul-sleep" }
        ];

        function findHeroMatches(query) {
          var normalizedQuery = expandAskContractions(normalizeSearchText(query.trim()));
          if (!normalizedQuery) return [];
          var words = normalizedQuery.split(/\s+/).map(function (w) { return w.replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, ""); }).filter(function (w) { return w && !ASK_STOPWORDS[w]; });
          if (!words.length) return [];
          /* Synonym expansion: add the cards' vocabulary alongside the user's words. */
          var expanded = words.slice();
          words.forEach(function (word) {
            (ASK_SYNONYMS[word] || []).forEach(function (syn) {
              if (expanded.indexOf(syn) === -1) expanded.push(syn);
            });
          });
          words = expanded;
          return cards.map(function (card, index) {
            var title = card.querySelector("h3").textContent.trim();
            var normalizedTitle = normalizeSearchText(title);
            var normalizedCard = normalizeSearchText(card.textContent);
            var titleWords = normalizedTitle.split(/[^a-z0-9']+/).filter(Boolean).map(function (w) { return w.replace(/^'+|'+$/g, ""); });
            var titleHits = 0, fuzzyHits = 0, bodyHits = 0, phraseHits = 0;
            words.forEach(function (word) {
              if (normalizedTitle.indexOf(word) !== -1) titleHits++;
              else if (titleWords.some(function (tw) { return withinOneEdit(word, tw); })) fuzzyHits++;
              else if (normalizedCard.indexOf(word) !== -1) bodyHits++;
            });
            var slug = (card.id || "").replace(/^answer-/, "");
            ASK_PHRASES.forEach(function (entry) {
              if (entry.slug === slug && normalizedQuery.indexOf(entry.phrase) !== -1) phraseHits++;
            });
            var score = titleHits * 3 + fuzzyHits * 2 + bodyHits + phraseHits * 4;
            return score > 0 ? { index: index, title: title, score: score } : null;
          }).filter(Boolean).sort(function (a, b) { return b.score - a.score || a.index - b.index; });
        }

        function closeHeroResults() {
          heroSearchResults.setAttribute("data-open", "false");
          heroSearch.setAttribute("aria-expanded", "false");
        }

        function openHeroMatch(match) {
          if (!match) return;
          closeHeroResults();
          showCard(match.index, { scroll: true });
        }

        function renderHeroMatches() {
          var query = heroSearch.value.trim();
          heroMatches = findHeroMatches(query);
          heroSearchResults.innerHTML = "";
          heroTopicChips.forEach(function (chip) {
            chip.setAttribute("aria-pressed", normalizeSearchText(chip.getAttribute("data-hero-query")) === normalizeSearchText(query) ? "true" : "false");
          });
          if (!query) {
            closeHeroResults();
            return;
          }
          if (!heroMatches.length) {
            var emptyResult = document.createElement("div");
            emptyResult.className = "hero-no-results";
            var emptyP1 = document.createElement("p");
            emptyP1.textContent = "I don't have a defense for that yet.";
            var emptyP2 = document.createElement("p");
            var suggestLink = document.createElement("a");
            suggestLink.href = "#suggest";
            suggestLink.textContent = "Suggest it as a new defense";
            suggestLink.addEventListener("click", closeHeroResults);
            emptyP2.appendChild(suggestLink);
            emptyP2.appendChild(document.createTextNode(" \u2014 the strongest submissions become new cards."));
            emptyResult.appendChild(emptyP1);
            emptyResult.appendChild(emptyP2);
            heroSearchResults.appendChild(emptyResult);
          } else {
            var topMatches = heroMatches.slice(0, 3);
            var relatedMatches = heroMatches.slice(3, 6);
            function addResultGroup(label, list) {
              if (!list.length) return;
              var heading = document.createElement("div");
              heading.className = "hero-result-group-label";
              heading.textContent = label;
              heroSearchResults.appendChild(heading);
              list.forEach(function (match) {
                var button = document.createElement("button");
                button.type = "button";
                button.className = "hero-result";
                button.setAttribute("role", "option");
                button.setAttribute("aria-label", "Open defense " + (match.index + 1) + ": " + match.title);
                button.innerHTML = '<span class="hero-result-num"></span><span class="hero-result-title"></span>';
                button.querySelector(".hero-result-num").textContent = String(match.index + 1).padStart(2, "0");
                button.querySelector(".hero-result-title").textContent = match.title;
                button.addEventListener("click", function () { openHeroMatch(match); });
                heroSearchResults.appendChild(button);
              });
            }
            addResultGroup("Best matches", topMatches);
            addResultGroup("Related questions", relatedMatches);
          }
          heroSearchResults.setAttribute("data-open", "true");
          heroSearch.setAttribute("aria-expanded", "true");
        }

        var dailyStrip = document.getElementById("dailyStrip");
        if (dailyStrip && defenses && defenses.length) {
          var dayIdx = Math.floor(Date.now() / 86400000) % defenses.length;
          var dayTitle = document.getElementById("dailyTitle");
          if (dayTitle) dayTitle.textContent = "#" + (dayIdx + 1) + " \u2014 " + defenses[dayIdx].title;
          dailyStrip.hidden = false;
          dailyStrip.addEventListener("click", function () { showCard(dayIdx, { scroll: true }); });
        }
        heroSearch.addEventListener("input", renderHeroMatches);
        heroSearch.addEventListener("focus", function () {
          if (heroSearch.value.trim()) renderHeroMatches();
        });
        heroSearch.addEventListener("keydown", function (event) {
          if (event.key === "Enter" && heroMatches.length) {
            event.preventDefault();
            openHeroMatch(heroMatches[0]);
          } else if (event.key === "ArrowDown") {
            var firstResult = heroSearchResults.querySelector(".hero-result");
            if (firstResult) { event.preventDefault(); firstResult.focus(); }
          } else if (event.key === "Escape") {
            closeHeroResults();
          }
        });
        /* ArrowUp/ArrowDown cycle focus through the result buttons, so the
           search works fully from the keyboard. */
        heroSearchResults.addEventListener("keydown", function (event) {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          var results = Array.prototype.slice.call(heroSearchResults.querySelectorAll(".hero-result"));
          if (!results.length) return;
          var idx = results.indexOf(document.activeElement);
          event.preventDefault();
          if (event.key === "ArrowDown") {
            results[idx === -1 || idx === results.length - 1 ? 0 : idx + 1].focus();
          } else if (idx <= 0) {
            heroSearch.focus();
          } else {
            results[idx - 1].focus();
          }
        });
        var heroSearchBtn = document.getElementById("heroSearchBtn");
        if (heroSearchBtn) {
          heroSearchBtn.addEventListener("click", function () {
            renderHeroMatches();
            if (heroMatches.length) openHeroMatch(heroMatches[0]);
          });
        }
        heroTopicChips.forEach(function (chip) {
          chip.addEventListener("click", function () {
            heroSearch.value = chip.getAttribute("data-hero-query");
            renderHeroMatches();
            heroSearch.focus();
          });
        });

        prevButton.addEventListener("click", function () { showCard(currentCard - 1); });
        nextButton.addEventListener("click", function () { showCard(currentCard + 1); });
        var shuffleButton = document.getElementById("deckShuffle");
        if (shuffleButton) {
          shuffleButton.addEventListener("click", function () {
            if (cards.length < 2) return;
            var next = currentCard;
            while (next === currentCard) next = Math.floor(Math.random() * cards.length);
            showCard(next, { scroll: true });
          });
        }
        var deckJumpForm = document.getElementById("deckJumpForm");
        var deckJumpInput = document.getElementById("deckJumpInput");
        if (deckJumpForm && deckJumpInput) {
          deckJumpInput.setAttribute("max", String(cards.length));
          deckJumpInput.setAttribute("placeholder", "1\u2013" + cards.length);
          deckJumpForm.addEventListener("submit", function (event) {
            event.preventDefault();
            var n = parseInt(deckJumpInput.value, 10);
            if (n >= 1 && n <= cards.length) {
              showCard(n - 1, { scroll: true });
              deckJumpInput.value = "";
              deckJumpInput.blur();
            } else {
              deckJumpInput.focus();
              deckJumpInput.select();
            }
          });
        }
        viewport.addEventListener("keydown", function (event) {
          if (event.target !== viewport) return;
          if (event.key === "ArrowLeft") { event.preventDefault(); showCard(currentCard - 1); }
          if (event.key === "ArrowRight") { event.preventDefault(); showCard(currentCard + 1); }
        });

        var touchStartX = 0;
        var touchStartY = 0;
        var touchTracking = false;
        viewport.addEventListener("touchstart", function (event) {
          if (event.touches.length !== 1) return;
          touchStartX = event.touches[0].clientX;
          touchStartY = event.touches[0].clientY;
          touchTracking = true;
        }, { passive: true });
        viewport.addEventListener("touchend", function (event) {
          if (!touchTracking || !event.changedTouches.length) return;
          touchTracking = false;
          var dx = event.changedTouches[0].clientX - touchStartX;
          var dy = event.changedTouches[0].clientY - touchStartY;
          if (Math.abs(dx) < 52 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
          showCard(dx < 0 ? currentCard + 1 : currentCard - 1);
        }, { passive: true });
        viewport.addEventListener("touchcancel", function () { touchTracking = false; }, { passive: true });

        track.addEventListener("click", function (event) {
          var target = event.target;
          var bmBtn = target && target.closest ? target.closest("[data-bookmark]") : null;
          if (bmBtn) {
            var entry = bmBtn.closest(".entry");
            var slug = entry ? entry.getAttribute("data-entry") : null;
            if (slug) {
              var nowSaved = toggleBookmark(slug);
              bmBtn.setAttribute("aria-pressed", nowSaved ? "true" : "false");
              bmBtn.textContent = nowSaved ? "★ Saved to My Armory" : "☆ Save to My Armory";
              renderMyArmory();
            }
            return;
          }
          var rel = target && target.closest ? target.closest("[data-related-title]") : null;
          if (rel) {
            var title = rel.getAttribute("data-related-title");
            var idx = defenses.findIndex(function (d) { return d.title === title; });
            if (idx >= 0) showCard(idx, { scroll: true });
            return;
          }
          var readBtn = target && target.closest ? target.closest("[data-read]") : null;
          if (readBtn) {
            var rCardEl = readBtn.closest(".entry");
            var rIdx = rCardEl ? cards.indexOf(rCardEl) : -1;
            if (rIdx >= 0) toggleReadAloud(defenses[rIdx], readBtn);
            return;
          }
          var btn = target && target.closest ? target.closest("[data-share]") : null;
          if (!btn) return;
          var cardEl = btn.closest(".entry");
          if (!cardEl || !cardEl.id) return;
          var url = window.location.origin + window.location.pathname + "#" + cardEl.id;
          var original = btn.textContent;
          function done() {
            btn.textContent = "✓ Copied!";
            window.setTimeout(function () { btn.textContent = original; }, 1600);
          }
          function fallbackCopy(text) {
            var ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand("copy"); } catch (e) {}
            document.body.removeChild(ta);
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(done, function () { fallbackCopy(url); done(); });
          } else {
            fallbackCopy(url);
            done();
          }
        });

        

        var quizCard = document.getElementById("quizCard");
        if (quizCard && defenses && defenses.length) {
          var quizObjection = document.getElementById("quizObjection");
          var quizAnswer = document.getElementById("quizAnswer");
          var quizOneLiner = document.getElementById("quizOneLiner");
          var quizReveal = document.getElementById("quizReveal");
          var quizNext = document.getElementById("quizNext");
          var quizKnew = document.getElementById("quizKnew");
          var quizMissed = document.getElementById("quizMissed");
          var quizFull = document.getElementById("quizFull");
          var quizScore = document.getElementById("quizScore");
          var quizReset = document.getElementById("quizReset");
          var modeFlash = document.getElementById("modeFlash");
          var modeExplain = document.getElementById("modeExplain");
          var explainCard = document.getElementById("explainCard");
          var explainObjection = document.getElementById("explainObjection");
          var explainText = document.getElementById("explainText");
          var explainAnswer = document.getElementById("explainAnswer");
          var explainOneLiner = document.getElementById("explainOneLiner");
          var explainSummary = document.getElementById("explainSummary");
          var explainCompare = document.getElementById("explainCompare");
          var explainNext = document.getElementById("explainNext");
          var explainKnew = document.getElementById("explainKnew");
          var explainMissed = document.getElementById("explainMissed");
          var explainFull = document.getElementById("explainFull");
          var explainScore = document.getElementById("explainScore");
          var quizOrder = [];
          var quizPos = -1;
          var quizIndex = 0;
          var quizRight = 0;
          var quizAnswered = 0;
          var quizScored = false;
          var drillMode = "flash";
          var MASTER_KEY = "ca_mastered_v1";
          function loadMastered() {
            try { return JSON.parse(localStorage.getItem(MASTER_KEY)) || []; } catch (e) { return []; }
          }
          function saveMastered(list) {
            try { localStorage.setItem(MASTER_KEY, JSON.stringify(list)); } catch (e) {}
          }
          var mastered = loadMastered();
          function markMastered(slug, known) {
            var i = mastered.indexOf(slug);
            if (known && i === -1) mastered.push(slug);
            if (!known && i !== -1) mastered.splice(i, 1);
            saveMastered(mastered);
          }
          function updateDrillScore() {
            var txt = "Mastered " + mastered.length + " of " + defenses.length +
              (quizAnswered ? " \u00b7 Score: " + quizRight + " of " + quizAnswered + " \u2014 be honest, it only helps you." : " \u2014 be honest with yourself.");
            quizScore.textContent = txt;
            if (explainScore) explainScore.textContent = txt;
          }

          function shuffleArr(a) {
            for (var i = a.length - 1; i > 0; i--) {
              var j = Math.floor(Math.random() * (i + 1));
              var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
            }
            return a;
          }
          function quizShuffleOrder() {
            var un = [], ma = [];
            defenses.forEach(function (card, i) { (mastered.indexOf(card.slug) === -1 ? un : ma).push(i); });
            quizOrder = shuffleArr(un).concat(shuffleArr(ma));
          }
          function quizShow() {
            drillAdvance();
            updateDrillScore();
          }
          function quizVerdict(knew) {
            if (quizScored) return;
            quizScored = true;
            quizAnswered++;
            if (knew) quizRight++;
            markMastered(defenses[quizIndex].slug, knew);
            updateDrillScore();
          }
          function drillAdvance() {
            if (quizPos + 1 >= quizOrder.length) {
              quizShuffleOrder();
              quizPos = -1;
            }
            quizPos++;
            quizIndex = quizOrder[quizPos];
            quizScored = false;
            if (drillMode === "flash") quizShowCard(); else explainShowCard();
          }
          function quizShowCard() {
            var d = defenses[quizIndex];
            quizObjection.innerHTML = d.objection;
            quizOneLiner.innerHTML = d.oneLiner;
            quizAnswer.hidden = true;
            quizReveal.hidden = false;
            quizNext.hidden = true;
          }
          function explainShowCard() {
            var d = defenses[quizIndex];
            explainObjection.innerHTML = d.objection;
            explainText.value = "";
            explainOneLiner.innerHTML = d.oneLiner;
            explainSummary.innerHTML = d.summary;
            explainAnswer.hidden = true;
            explainCompare.hidden = false;
            explainNext.hidden = true;
          }
          function setDrillMode(mode) {
            drillMode = mode;
            var flash = mode === "flash";
            quizCard.hidden = !flash;
            if (explainCard) explainCard.hidden = flash;
            if (modeFlash) modeFlash.setAttribute("aria-selected", flash ? "true" : "false");
            if (modeExplain) modeExplain.setAttribute("aria-selected", flash ? "false" : "true");
            quizScored = false;
            if (flash) quizShowCard(); else explainShowCard();
          }
          quizReveal.addEventListener("click", function () {
            quizAnswer.hidden = false;
            quizReveal.hidden = true;
            quizNext.hidden = false;
          });
          quizKnew.addEventListener("click", function () { quizVerdict(true); });
          quizMissed.addEventListener("click", function () { quizVerdict(false); });
          quizNext.addEventListener("click", function () { drillAdvance(); updateDrillScore(); });
          quizFull.addEventListener("click", function () {
            showCard(quizIndex, { scroll: true });
          });
          if (quizReset) quizReset.addEventListener("click", function () {
            mastered = [];
            saveMastered(mastered);
            updateDrillScore();
          });
          if (modeFlash) modeFlash.addEventListener("click", function () { setDrillMode("flash"); });
          if (modeExplain) modeExplain.addEventListener("click", function () { setDrillMode("explain"); });
          if (explainCompare) explainCompare.addEventListener("click", function () {
            explainAnswer.hidden = false;
            explainCompare.hidden = true;
            explainNext.hidden = false;
          });
          if (explainKnew) explainKnew.addEventListener("click", function () { quizVerdict(true); });
          if (explainMissed) explainMissed.addEventListener("click", function () { quizVerdict(false); });
          if (explainNext) explainNext.addEventListener("click", function () { drillAdvance(); updateDrillScore(); });
          if (explainFull) explainFull.addEventListener("click", function () {
            showCard(quizIndex, { scroll: true });
          });
          quizShow();
        }

        if (window.ResizeObserver) {
          var deckObserver = new ResizeObserver(function () { updateDeckHeight(); });
          cards.forEach(function (card) { deckObserver.observe(card); });
        }
        window.addEventListener("resize", updateDeckHeight);

        function renderTopics() {
          if (!grid || !search || !empty) return;
          var query = search.value.trim().toLowerCase();
          var filtered = topics.filter(function (topic) {
            var matchesCategory = activeFilter === "all" || topic[1] === activeFilter;
            var matchesQuery = !query || (topic[0] + " " + topic[1]).toLowerCase().indexOf(query) !== -1;
            return matchesCategory && matchesQuery;
          });
          grid.innerHTML = "";
          filtered.forEach(function (topic) {
            var item = document.createElement("article");
            item.className = "topic";
            item.innerHTML = '<div><span class="topic-title"></span><span class="topic-cat"></span></div><span class="topic-state">Coming soon</span>';
            item.querySelector(".topic-title").textContent = topic[0];
            item.querySelector(".topic-cat").textContent = topic[1];
            grid.appendChild(item);
          });
          empty.style.display = filtered.length ? "none" : "block";
        }

        if (search) search.addEventListener("input", renderTopics);
        document.querySelectorAll(".filter").forEach(function (button) {
          button.addEventListener("click", function () {
            activeFilter = button.getAttribute("data-filter");
            document.querySelectorAll(".filter").forEach(function (other) {
              other.setAttribute("aria-pressed", other === button ? "true" : "false");
            });
            renderTopics();
          });
        });

        document.querySelectorAll(".entry").forEach(function (entry) {
          var tabs = Array.prototype.slice.call(entry.querySelectorAll(".entry-nav button"));
          var panels = Array.prototype.slice.call(entry.querySelectorAll(".panel"));
          tabs.forEach(function (tab, index) {
            tab.addEventListener("click", function () {
              var targetId = tab.getAttribute("aria-controls");
              tabs.forEach(function (other) { other.setAttribute("aria-selected", other === tab ? "true" : "false"); });
              panels.forEach(function (panel) { panel.classList.toggle("active", panel.id === targetId); });
              window.requestAnimationFrame(updateDeckHeight);
            });
            tab.addEventListener("keydown", function (event) {
              var nextIndex = index;
              if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % tabs.length;
              if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + tabs.length) % tabs.length;
              if (nextIndex !== index) { event.preventDefault(); tabs[nextIndex].focus(); tabs[nextIndex].click(); }
            });
          });
        });

        var hashId = window.location.hash ? window.location.hash.slice(1) : "";
        var hashIndex = cards.findIndex(function (card) { return card.id === hashId; });
        showCard(hashIndex >= 0 ? hashIndex : 0, { updateHash: false });
        /* Deep link into a path lesson re-enters the path at that step. */
        var hashSlug = hashId.indexOf("answer-") === 0 ? hashId.slice("answer-".length) : "";
        var hashStep = START_HERE.findIndex(function (s) { return s.slug === hashSlug; });
        if (hashStep >= 0) {
          activePathStep = hashStep;
          pathComplete = false;
          renderPathBanner();
          var hashCard = cards[hashIndex];
          var hashSimple = hashCard && hashCard.querySelector('[data-panel="simple"]');
          if (hashSimple) hashSimple.click();
        }
        if (hashIndex >= 0 && viewport.scrollIntoView) window.setTimeout(function () { viewport.scrollIntoView({ block: "start" }); }, 0);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateDeckHeight);
        renderTopics();

        /* In-page links to a defense (e.g. "See defense #52"): the deck is a
           carousel, so a native anchor jump can't surface a hidden card.
           Drive the deck to the card instead. */
        document.addEventListener("click", function (event) {
          var a = event.target.closest ? event.target.closest('a[href^="#answer-"]') : null;
          if (!a) return;
          var slug = a.getAttribute("href").slice("#answer-".length);
          var idx = defenses.findIndex(function (d) { return d.slug === slug; });
          if (idx < 0) return;
          event.preventDefault();
          showCard(idx, { scroll: true });
        });

        /* Catechism reader: tappable references, modal, paragraph jumper */
        document.addEventListener("click", function (event) {
          var b = event.target.closest ? event.target.closest(".ccc-ref") : null;
          if (b) openCccModal(parseInt(b.getAttribute("data-ccc"), 10));
        });
        document.getElementById("cccModalClose").addEventListener("click", closeCccModal);
        document.getElementById("cccModalPrev").addEventListener("click", function () { renderCccModal(cccCurrent - 1); });
        document.getElementById("cccModalNext").addEventListener("click", function () { renderCccModal(cccCurrent + 1); });
        document.getElementById("cccModalBackdrop").addEventListener("click", function (event) {
          if (event.target === this) closeCccModal();
        });
        document.addEventListener("keydown", function (event) {
          if (event.key === "Escape" && !document.getElementById("cccModalBackdrop").hidden) closeCccModal();
        });
        /* Scripture popups: tappable verse references, CPDV text modal */
        document.addEventListener("click", function (event) {
          var b = event.target.closest ? event.target.closest(".verse-ref") : null;
          if (b) openVerseModal(b.getAttribute("data-verse"));
        });
        document.getElementById("verseModalClose").addEventListener("click", closeVerseModal);
        document.getElementById("verseModalBackdrop").addEventListener("click", function (event) {
          if (event.target === this) closeVerseModal();
        });
        document.addEventListener("keydown", function (event) {
          if (event.key === "Escape" && !document.getElementById("verseModalBackdrop").hidden) closeVerseModal();
        });
        /* Glossary terms: tappable definitions inside card text */
        function closeGlossModal() { document.getElementById("glossModalBackdrop").hidden = true; }
        document.addEventListener("click", function (event) {
          var b = event.target.closest ? event.target.closest(".gloss-term") : null;
          if (!b) return;
          var term = b.getAttribute("data-gloss");
          var g = null;
          for (var i = 0; i < (window.GLOSSARY || []).length; i++) {
            if (window.GLOSSARY[i].term === term) { g = window.GLOSSARY[i]; break; }
          }
          if (!g) return;
          document.getElementById("glossModalTitle").textContent = g.term;
          document.getElementById("glossModalBody").innerHTML =
            (g.pronunciation ? '<p class="gloss-pron">(' + escapeHtml(g.pronunciation) + ")</p>" : "") +
            "<p>" + escapeHtml(g.definition) + "</p>";
          document.getElementById("glossModalBackdrop").hidden = false;
        });
        document.getElementById("glossModalClose").addEventListener("click", closeGlossModal);
        document.getElementById("glossModalBackdrop").addEventListener("click", function (event) {
          if (event.target === this) closeGlossModal();
        });
        document.addEventListener("keydown", function (event) {
          if (event.key === "Escape" && !document.getElementById("glossModalBackdrop").hidden) closeGlossModal();
        });
        var cccJumpInput = document.getElementById("cccJump");
        var cccJumpBtn = document.getElementById("cccJumpBtn");
        function cccDoJump() {
          var n = parseInt(cccJumpInput.value, 10);
          if (n >= 1 && n <= 2865) { openCccModal(n); }
          else { cccJumpInput.focus(); }
        }
        cccJumpBtn.addEventListener("click", cccDoJump);
        cccJumpInput.addEventListener("keydown", function (event) { if (event.key === "Enter") cccDoJump(); });
}

var ASSET_V = window.ASSET_V || "dev";
var DEFENSE_SHARDS = ["defenses-1.json", "defenses-2.json", "defenses-3.json", "defenses-7.json", "defenses-4.json", "defenses-5.json", "defenses-6.json", "defenses-8.json", "defenses-9.json"];
/* Verse text is sharded like the defenses (verses.json outgrew the push size
   ceiling); both halves load in parallel and merge into one VERSES object.
   All-or-nothing: if either half fails, verse popups stay off, as before. */
var VERSE_SHARDS = ["verses-1.json", "verses-2.json"];
/* Glossary loads alongside the defenses so card text can link its terms. */
Promise.all([
  Promise.all(DEFENSE_SHARDS.map(function (f) {
    return fetch(f + "?v=" + ASSET_V).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  })).then(function (parts) { return [].concat.apply([], parts); }),
  fetch("glossary.json?v=" + ASSET_V)
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .catch(function () { return null; }),
  Promise.all(VERSE_SHARDS.map(function (f) {
    return fetch(f + "?v=" + ASSET_V).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  })).then(function (parts) {
    var merged = {};
    parts.forEach(function (p) { Object.keys(p).forEach(function (k) { merged[k] = p[k]; }); });
    return merged;
  })
    .catch(function () { return null; })
])
  .then(function (res) {
    var defenses = res[0], glossary = res[1], verses = res[2];
    window.VERSES = verses;
    window.GLOSSARY = glossary || [];
    if (glossary) {
      renderGlossary(glossary);
    } else {
      var gtrack = document.getElementById("glossaryTrack");
      if (gtrack) gtrack.innerHTML = '<p class="load-error" style="padding:1rem">Could not load the glossary. Check your connection and reload.</p>';
    }
    renderSite(defenses); initApp(defenses);
  })
  .catch(function () {
    var track = document.getElementById("deckTrack");
    if (track) track.innerHTML = '<p class="load-error" style="padding:2rem;text-align:center">Could not load the defenses. Check your connection and reload.</p>';
  });

fetch("apostles.json?v=" + ASSET_V)
  .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
  .then(renderApostles)
  .catch(function () {
    var track = document.getElementById("apostlesTrack");
    if (track) track.innerHTML = '<p class="load-error" style="padding:1rem">Could not load the apostles. Check your connection and reload.</p>';
  });

/* Objection suggestion form: sends to the keeper's inbox via FormSubmit (AJAX).
   First-ever submission triggers a one-time activation email to the inbox. */
(function () {
  var form = document.getElementById("suggestForm");
  if (!form) return;
  var nameField = document.getElementById("suggestName");
  var objectionField = document.getElementById("suggestObjection");
  var note = document.getElementById("suggestNote");
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var objection = objectionField.value.trim();
    if (!objection) {
      note.textContent = "Please write the objection first.";
      objectionField.focus();
      return;
    }
    note.textContent = "Sending…";
    fetch("https://formsubmit.co/ajax/e36522@gmail.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        name: nameField.value.trim(),
        objection: objection,
        _subject: "New objection submitted — Christian Armory",
        _honey: form.querySelector('[name="_honey"]').value,
        _captcha: "true"
      })
    })
      .then(function (response) { return response.json(); })
      .then(function () {
        note.textContent = "Received — thank you. If it becomes a defense, you'll see it here.";
        form.reset();
      })
      .catch(function () {
        note.textContent = "Something went wrong sending that. Please try again.";
      });
  });
})();

/* Installable app: register the service worker (https only; skipped in tests). */
if ("serviceWorker" in navigator && /^https:$/.test(window.location.protocol)) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  });
}

/* Scrollspy: highlight the jump-nav chip for the section currently in view. */
(function () {
  var nav = document.querySelector(".section-jump");
  if (!nav || !("IntersectionObserver" in window)) return;
  var links = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]'));
  var targets = [];
  links.forEach(function (a) {
    var el = document.getElementById(a.getAttribute("href").slice(1));
    if (el) targets.push({ id: el.id, link: a, el: el });
  });
  if (!targets.length) return;
  function setActive(id) {
    targets.forEach(function (t) {
      if (t.id === id) t.link.setAttribute("aria-current", "true");
      else t.link.removeAttribute("aria-current");
    });
  }
  var obs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) setActive(e.target.id);
    });
  }, { rootMargin: "-40% 0px -55% 0px" });
  targets.forEach(function (t) { obs.observe(t.el); });
})();

/* Collapsed reference sections: a jump link (or a section hash) opens the section first. */
(function () {
  function openDetailsForHash(hash) {
    if (!hash || hash.charAt(0) !== "#") return;
    var section = document.getElementById(hash.slice(1));
    var det = section && section.querySelector("details.section-details");
    if (det && !det.open) det.open = true;
  }
  document.addEventListener("click", function (event) {
    var a = event.target && event.target.closest ? event.target.closest(".section-jump a") : null;
    if (a) openDetailsForHash(a.getAttribute("href"));
  });
  window.addEventListener("hashchange", function () { openDetailsForHash(window.location.hash); });
  openDetailsForHash(window.location.hash);
})();
