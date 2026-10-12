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
    if (scroll && viewport) viewport.scrollIntoView({ behavior: "smooth", block: "start" });
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
    if (scroll && viewport) viewport.scrollIntoView({ behavior: "smooth", block: "start" });
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

function renderStandardCard(card, n, total) {
  var points = linkGlossaryTerms(card.response.map(function (p, k) {
    return '<li><span class="num">' + pad2(k + 1) + '</span> <div><b>' + p.heading + '</b> ' + p.body + '</div></li>';
  }).join(""));
  var verses = card.verses.map(function (v) { return "<span>" + v + "</span>"; }).join("");
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
    "<h3>" + card.title + "</h3>" +
    '<p class="entry-lede">' + linkGlossaryTerms(card.objection) + "</p>" +
    '<button type="button" class="share-btn" data-share>⧉ Copy link to this defense</button>' +
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
      return (/CCC\s+\d/.test(node.nodeValue)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    }
  });
  var nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(function (node) {
    var re = /CCC\s+(\d+)((?:\s*[-\u2013\u2014,;]\s*(?:cf\.\s*)?\d+)*)/g;
    var frag = document.createDocumentFragment();
    var last = 0, m;
    while ((m = re.exec(node.nodeValue))) {
      frag.appendChild(document.createTextNode(node.nodeValue.slice(last, m.index)));
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ccc-ref";
      btn.setAttribute("data-ccc", m[1]);
      btn.setAttribute("aria-label", "Read Catechism paragraph " + m[1]);
      btn.textContent = m[0];
      frag.appendChild(btn);
      last = m.index + m[0].length;
    }
    frag.appendChild(document.createTextNode(node.nodeValue.slice(last)));
    node.parentNode.replaceChild(frag, node);
  });
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
            (function (slug) {
              b.addEventListener("click", function () {
                var idx = defenses.findIndex(function (d) { return d.slug === slug; });
                if (idx >= 0) showCard(idx, { scroll: true });
              });
            })(step.slug);
            li.appendChild(b);
            startSteps.appendChild(li);
          });
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
          })(index, card.oneLiner, copy);
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
            var v = document.createElement("span"); v.textContent = s.verse;
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
            if (scroll && viewport) viewport.scrollIntoView({ behavior: "smooth", block: "start" });
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
          head.appendChild(h); head.appendChild(count);
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
          wrap.appendChild(head); wrap.appendChild(controls); wrap.appendChild(viewport);
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

        function showCard(index, options) {
          options = options || {};
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
          if (options.scroll) viewport.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        function normalizeSearchText(value) {
          return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’‘]/g, "'");
        }

        function findHeroMatches(query) {
          var normalizedQuery = normalizeSearchText(query.trim());
          if (!normalizedQuery) return [];
          var words = normalizedQuery.split(/\s+/).filter(Boolean);
          return cards.map(function (card, index) {
            var title = card.querySelector("h3").textContent.trim();
            var normalizedTitle = normalizeSearchText(title);
            var normalizedCard = normalizeSearchText(card.textContent);
            var matches = words.every(function (word) { return normalizedCard.indexOf(word) !== -1; });
            var score = normalizedTitle === normalizedQuery ? 0 : normalizedTitle.indexOf(normalizedQuery) === 0 ? 1 : normalizedTitle.indexOf(normalizedQuery) !== -1 ? 2 : 3;
            return matches ? { index: index, title: title, score: score } : null;
          }).filter(Boolean).sort(function (a, b) { return a.score - b.score || a.index - b.index; });
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
            var emptyResult = document.createElement("p");
            emptyResult.className = "hero-no-results";
            emptyResult.textContent = "No defense matches that search yet.";
            heroSearchResults.appendChild(emptyResult);
          } else {
            heroMatches.slice(0, 6).forEach(function (match) {
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
          heroSearchResults.setAttribute("data-open", "true");
          heroSearch.setAttribute("aria-expanded", "true");
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
          var rel = target && target.closest ? target.closest("[data-related-title]") : null;
          if (rel) {
            var title = rel.getAttribute("data-related-title");
            var idx = defenses.findIndex(function (d) { return d.title === title; });
            if (idx >= 0) showCard(idx, { scroll: true });
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
          var quizOrder = [];
          var quizPos = -1;
          var quizIndex = 0;
          var quizRight = 0;
          var quizAnswered = 0;
          var quizScored = false;

          function quizShuffleOrder() {
            quizOrder = defenses.map(function (card, i) { return i; });
            for (var i = quizOrder.length - 1; i > 0; i--) {
              var j = Math.floor(Math.random() * (i + 1));
              var tmp = quizOrder[i];
              quizOrder[i] = quizOrder[j];
              quizOrder[j] = tmp;
            }
          }
          function quizShow() {
            if (quizPos + 1 >= quizOrder.length) {
              quizShuffleOrder();
              quizPos = -1;
            }
            quizPos++;
            quizIndex = quizOrder[quizPos];
            quizScored = false;
            var d = defenses[quizIndex];
            quizObjection.innerHTML = d.objection;
            quizOneLiner.innerHTML = d.oneLiner;
            quizAnswer.hidden = true;
            quizReveal.hidden = false;
            quizNext.hidden = true;
            quizScore.textContent = quizAnswered
              ? "Score: " + quizRight + " of " + quizAnswered + " — be honest, it only helps you."
              : "No score yet — be honest with yourself.";
          }
          function quizVerdict(knew) {
            if (quizScored) return;
            quizScored = true;
            quizAnswered++;
            if (knew) quizRight++;
            quizScore.textContent = "Score: " + quizRight + " of " + quizAnswered + " — be honest, it only helps you.";
          }
          quizReveal.addEventListener("click", function () {
            quizAnswer.hidden = false;
            quizReveal.hidden = true;
            quizNext.hidden = false;
          });
          quizKnew.addEventListener("click", function () { quizVerdict(true); });
          quizMissed.addEventListener("click", function () { quizVerdict(false); });
          quizNext.addEventListener("click", quizShow);
          quizFull.addEventListener("click", function () {
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
        if (hashIndex >= 0) window.setTimeout(function () { viewport.scrollIntoView({ block: "start" }); }, 0);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateDeckHeight);
        renderTopics();

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
var DEFENSE_SHARDS = ["defenses-1.json", "defenses-2.json", "defenses-3.json", "defenses-4.json", "defenses-5.json"];
/* Glossary loads alongside the defenses so card text can link its terms. */
Promise.all([
  Promise.all(DEFENSE_SHARDS.map(function (f) {
    return fetch(f + "?v=" + ASSET_V).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  })).then(function (parts) { return [].concat.apply([], parts); }),
  fetch("glossary.json?v=" + ASSET_V)
    .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .catch(function () { return null; })
])
  .then(function (res) {
    var defenses = res[0], glossary = res[1];
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
