# Christian Armory — your own website

A mobile-friendly Catholic apologetics field guide (Christian Armory): 50 swipeable defense cards,
each with a Catholic response, a one-liner, verses to remember, Catechism
references, and related topics. Plus a search-first hero ("What objection did
you hear?") and a "Jump to a defense" index.

**How it's built:** plain static files — no server, no database, no build step,
nothing to maintain. All 50 defenses live in **`defenses.json`**; `index.html`
renders them at load. To change content you edit one JSON file, never the code.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole site (layout, styling, app logic). You should never need to edit this. |
| `defenses.json` | **All 50 defenses — this is the file you edit to update the site.** |
| `.nojekyll` | Tells GitHub Pages to serve files as-is. Leave it alone. |
| `README.md` | This guide. |

## Put it on GitHub Pages (free)

1. On github.com, create a new **public** repository (e.g. `apologetics-guide`).
   Don't add a README/license — you'll upload files next.
2. On the repo page click **Add file → Upload files**, drag in `index.html`,
   `defenses.json`, and `.nojekyll`, then **Commit changes**.
3. Go to **Settings → Pages**. Under "Build and deployment", set Source to
   **Deploy from a branch**, Branch to **main** / **(root)**, Save.
4. Wait ~1 minute. Your site is live at
   `https://<your-username>.github.io/apologetics-guide/`.

## Connect your own domain (later, when you buy it)

1. Buy the domain from any registrar (Cloudflare, Porkbun, Namecheap…).
2. In the repo: **Settings → Pages → Custom domain**, enter your domain, Save.
   This creates the `CNAME` file for you.
3. At your registrar, add these DNS records:
   - `A` records pointing to `185.199.108.153`, `185.199.109.153`,
     `185.199.110.153`, `185.199.111.153` (for the bare domain), and/or
   - a `CNAME` record for `www` pointing to `<your-username>.github.io`.
4. Back in Settings → Pages, tick **Enforce HTTPS**. DNS can take a few
   minutes to a few hours to propagate.

## Updating the site later

Every defense is one object in `defenses.json`:

```json
{
  "slug": "jesus-divinity",
  "jumpLabel": "Jesus is not God",
  "title": "Jesus is not God",
  "objection": "<p>…strongest form of the objection…</p>",
  "summary": "One-sentence summary shown under the title.",
  "response": [
    { "heading": "Bold lead-in.", "body": "<p>…paragraph, may contain <i>italics</i>…</p>" },
    …
  ],
  "verses": ["John 8:58", "John 10:30-33"],
  "ccc": "CCC 461, 464",
  "oneLiner": "\"The pocket one-liner.\"",
  "related": [
    { "title": "Other defense title", "description": "Why it's related." }
  ]
}
```

- **Fix a typo / reword a card:** edit the fields, commit. The site rebuilds
  itself in about a minute. Nothing else to do.
- **Add a new defense:** copy any card object, paste it at the end of the
  array (before the closing `]`), give it a unique `slug` (lowercase,
  hyphens), fill in the fields, commit. It appears automatically as the new
  last card, in the deck, the jump index, counters, and search.
- **Tips:** `objection`, `summary`, `body`, and `oneLiner` may contain simple
  HTML (`<p>`, `<b>`, `<i>`). Keep `slug` unique — it's used for links.
  Validate your JSON after editing (e.g. paste it into jsonlint.com) — one
  stray comma breaks the page.

One card (`accident-of-birth`, #2) uses an older 4-tab layout kept verbatim
for fidelity; its content lives in the `customBody` field. You can leave it
as-is or ask to have it converted to the standard format.

## Notes

- Fonts (Literata + Public Sans) load from Google Fonts, so the site needs
  internet access — normal for any website.
- The deck counter, jump carousel, dots, and search all update automatically
  from `defenses.json`. You never touch `index.html`.
