# Weekly SEO guide pages (dreampattern.app/dreams/)

Rob asked on 2026-11-02 for one search-focused page a week on each app's website. A scheduled task adds the next page every Friday.

## How a page is made
- Guides live in `marketing/guides/<slug>.json` (copy `how-to-remember-your-dreams.json`). Fields: slug, title (`<title>`), h1, description, keyword, date (YYYY-MM-DD), intro (HTML), sections (`h2` + `html`), faq (`[question, answer]` pairs), related (guide or symbol slugs).
- Backlog items marked **symbol** are new dream dictionary entries: add an object to `marketing/dictionary/symbols.json` instead (same shape as the others), and link it from 2-3 related symbols' `related` lists.
- Run `python3 marketing/dictionary/build.py` from the repo root. It writes the page to `site/dreams/`, adds it to the `/dreams/` index (guides newest first) and `site/sitemap.xml`. Commit the JSON and the generated HTML together.
- Guide slugs must not clash with symbol slugs (the build checks).

## Rules
- One page a week. Each page answers one real question people search for, better than what ranks today. Thin or duplicate pages hurt the whole site, so quality beats volume.
- Target keyword in the title, the h1, the first paragraph, the slug and the description. Use it and close variants naturally a few more times. No keyword stuffing, hidden text or doorway pages.
- Guides: 800-1,400 words, short paragraphs, H2s phrased the way people search. 4-6 question FAQ (the build emits FAQPage + Article JSON-LD with datePublished).
- Link to 2+ dictionary pages or guides inside the body.
- Dreams are personal: frame meanings as common themes and questions to reflect on, never predictions. No made-up stats, studies, quotes or testimonials. Don't name real people.
- Sleep and nightmare topics: no medical or treatment advice; point people to a doctor where it fits (the build adds the not-medical-advice line).
- One short, honest mention of DreamPattern where it genuinely helps; the build adds the App Store card.
- Voice: calm, warm, curious, plain English (US spelling).

## Backlog (top = next). Strike through when published.
1. ~~How to remember your dreams (how to remember your dreams)~~ 2026-11-05
2. How to start a dream journal (dream journal, how to keep a dream journal)
3. **symbol** Dreaming of water (water dream meaning)
4. Recurring dreams: why they happen and what to do (recurring dreams)
5. **symbol** Dreaming of being shot (dream of being shot)
6. Lucid dreaming for beginners (how to lucid dream)
7. **symbol** Dreaming of your partner leaving you (dream partner leaves me)
8. Why do I dream about my ex? (why do I dream about my ex) — links to /dreams/ex-partner
9. **symbol** Dreaming of a school or classroom (dream about school)
10. What do nightmares mean? (nightmare meaning) — reflective, refer to a doctor for frequent nightmares
11. **symbol** Dreaming of hair falling out (hair falling out dream)
12. Why are my dreams so vivid? (vivid dreams) — no medical claims
13. **symbol** Dreaming of a car crash (car crash dream)
14. Dream symbols list: the 50 most common (dream symbols) — hub page linking the dictionary
15. **symbol** Dreaming of a bear (bear dream meaning)
16. Can you control your dreams? (control your dreams)
17. **symbol** Dreaming of an earthquake (earthquake dream)
18. What does it mean to dream about someone? (dreaming about someone)
19. **symbol** Dreaming of an elevator (elevator dream meaning)
20. Sleep paralysis vs. dreams: what's the difference? (sleep paralysis dream) — factual, cite NHS/NIH, refer to a doctor
