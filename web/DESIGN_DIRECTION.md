# Sinkronized · UI design direction

## Reference language

This project uses design principles observed in two public references, **not** their proprietary assets, source code, branding, or exact font files.

- [House of Giants](https://houseofgiants.com/) — confident, direct headline hierarchy, readable paragraph measure, simple navigation, purposeful emphasis.
- [Apple Ads](https://ads.apple.com/) — consistent modular tile grids, clear alignment across cards, generous negative space, predictable buttons and section rhythm.

The brand remains **Sinkronized**, with the existing Arizona logo, original Sonoran Sand palette, research language, and provenance.

## Where the system lives

- `web/design-system.css`: unified presentation and responsive rules. It loads **after** `styles.css` and `map.css` to provide one intentional design layer.
- `web/index.html`: semantic sections, navigation, research and field atlas.
- `web/app.js`: source-driven hotspot list, time chart, synchronization with map and study report. **Do not hardcode region names or measurements.**
- `web/motion.js`: decorative contour animation; respects reduced motion. It must not animate or change map science.
- `web/build-preview.mjs`: embeds the same source CSS and JS into `web/preview.html`. The portable preview's tile/image dependencies differ from a fully served site.

## Typographic scale (responsive)

| Element | Target CSS | Why |
| --- | --- | --- |
| Body typeface | DM Sans (Google Fonts), falling back to Segoe UI and Arial | Calm, readable longer scientific descriptions |
| Display typeface | Space Grotesk (Google Fonts), falling back to Avenir Next and Segoe UI | More distinctive but restrained headings |
| Brand wordmark | 24px, weight 750 | Clear but not dominant |
| Navigation | 12–13px, weight 600–700 | Compact but readable |
| Hero primary line | 45–68px, weight 750; 42–56px on mobile | Confident display hierarchy |
| Hero second line | 30–43px, weight 470 | Support headline rather than compete |
| Hero introduction | 18–21px, weight 500 | Laptop-readable |
| Body copy | 16–17px, line-height 1.65–1.76 | Comfortable reading measure |
| Section headings | 32–49px, weight ~730 | Distinguish major sections |
| Card headings | 19–27px, weight ~690–700 | Align across equal-height cards |
| Eyebrows and metadata | 11–12px, weight 750 | Secondary, not microtext |

## Grid and interaction rules

- Content width: `1360px` maximum for editorial sections; outer gutters `clamp(20px,4.3vw,72px)`.
- Cards use a consistent `18px` corner radius, light borders, limited shadows and aligned top headings.
- Three-across editorial cards reflow to one column on smaller screens. Never overflow paragraphs or cut off scientific source links.
- Primary CTA: dark ink fill, `13px` radius, `15px` readable label. Secondary CTA is simple underlined text.
- Navigation is restrained and sticky on desktop; mobile navigation wraps.
- Atlas stays **map-first**. Region names always come from the team’s `hotspots.geojson`. On selection, the authentic interactive chart appears with the map, and the detailed report is directly below for scrolling.
- Do not substitute decorative placeholder graphs for measured exports, or reinterpret a radar line-of-sight measurement as vertical ground motion without justification.
- Terrain and satellite basemaps and the current study overlays are unchanged.
- `prefers-reduced-motion: reduce` must preserve legibility and remove decorative animation.

## Review checklist

1. At typical 13–15-inch laptop widths, inspect the hero, navigation wrap, equal card alignment, map overlays and scroll-to-report flow.
2. At tablet and phone widths, check tiles, region selector, map height, graph accessibility and expandable measurement notes.
3. Compare graph dates with the map's cumulative frame date after hover, click/pin, play and reset.
4. Check source links, links to resources, and text/controls over the muted desert artwork.
5. Refresh `web/preview.html` using `node web/build-preview.mjs` after source changes.

**Deployment:** The public site (https://sinkronized.vercel.app) deploys from the fork `ray021207/NASA-Hackathon`, which Vercel is connected to. A workflow that exists only on that fork (`.github/workflows/sync-upstream.yml`) merges new commits from this repository's `main` into the fork every 5 minutes, and Vercel redeploys on every fork change. So **a merge here reaches the live site automatically, usually within 5 to 10 minutes. Nobody needs to sync anything by hand.** Do not push to the fork directly.

## Study report after laptop screenshot review

- Selecting a study region must **only** update the outlined study, interactive graph, selected data and report. It must **not** open the bottom field-note drawer.
- The basemap has no click-to-field-note behavior. ADWR context polygons must remain click-through so the study outline receives selection clicks. Discrete source markers may still have small attribution popups.
- Explicit **Explain** buttons remain interactive and use a compact explanation panel, not a full-width bottom sheet. Label text should be at least 14px.
- The field report begins with its authentic short insight summary, confidence labels and six concise insight cards. Each card exposes a first-sentence excerpt taken directly from the data; expanded text is the exact source text.
- Show the rate and region context side by side on laptops. Put observation records, ADWR comparisons, NISAR status and study limitations inside the **Methods, measurements & validation** disclosure, using a two-column grid when space permits.
- Preserve the existing interactive map graph, time-frame controls and full observation table. Nothing may fabricate movement rates or confidence.
- The Overview's **Why look in both directions?** explainer should display ascending and descending views as two cards on sufficiently wide screens, with the single-look uncertainty caveat intact.
- On narrow viewports, report cards and technical evidence collapse to one column. Avoid overlapping map controls and chart.

## Font loading

`web/index.html` requests the open-source DM Sans and Space Grotesk families via Google Fonts. If the font host is offline or blocked, the local fallbacks remain usable. No font binaries are checked into the repository.
