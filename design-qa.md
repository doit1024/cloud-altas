# Design QA — 云境 · 3D 云图鉴

## Comparison setup

- Source visual truth: `/var/folders/zw/jyswnxmn4jjbx33d01yzsjcw0000gn/T/codex-clipboard-cbeb2c4a-9d28-43c8-98ba-d0bbee3defc8.png`
- Browser-rendered implementation: `/Users/dumengjie/Documents/Codex/2026-09-17/chan/work/design-qa/implementation-facts-aligned-final.png`
- Combined comparison: `/Users/dumengjie/Documents/Codex/2026-09-17/chan/work/design-qa/comparison-facts-aligned-final.png`
- Responsive evidence: `/Users/dumengjie/Documents/Codex/2026-09-17/chan/work/design-qa/mobile-facts-aligned-final.png`
- Alignment issue reference: `/var/folders/zw/jyswnxmn4jjbx33d01yzsjcw0000gn/T/codex-clipboard-35743d94-1d57-411e-9869-4412f8bde3c2.png`
- Cloud-shape evidence: `/Users/dumengjie/Documents/Codex/2026-09-17/chan/work/design-qa/cirrocumulus-random-final.png` and `/Users/dumengjie/Documents/Codex/2026-09-17/chan/work/design-qa/altocumulus-random-final.png`
- Source pixels: 1487 × 1058 at 1× density.
- Implementation pixels / CSS viewport: 782 × 969 at 1× density in the Codex in-app browser.
- Mobile content viewport: 390 × 844 at 1× density, shown inside the in-app browser for capture.
- Normalization: source was proportionally scaled to 1362 × 969 and horizontally stacked with the 782 × 969 implementation. The source remains landscape while the available in-app preview is a narrow desktop viewport; comparison focuses on proportional hierarchy and the selected cloud state.
- State: Stratocumulus / 层积云 selected; Atmosphere panel closed.
- Primary interactions tested: all eight cloud-type selections and fact updates, canvas drag-to-orbit, drag starting over the title block with no text selection, Atmosphere disclosure, density slider availability, sunlight slider availability.
- Browser console: no warning or error entries.

## Full-view comparison evidence

The implementation reproduces the source's principal composition: luminous high-altitude panorama, left-side meteorological taxonomy rail, enlarged central cloud surface, right-side drag instruction, scale annotation, and lower-left bilingual cloud identity. The identity block now adds one concise Chinese science note beneath the existing altitude summary. Both the orbit ellipse and bottom progress axis remain intentionally absent, while the drag wording and arrows remain. The responsive 390 × 844 view preserves the hierarchy and leaves 7.8 px between the two-line science note and the horizontal cloud selector.

## Focused region comparison evidence

- Navigation and labels: reviewed at full screenshot scale and checked geometrically in-browser. The rail and every inactive/active dot share an exact x-coordinate of 50 px, eliminating the visible offset in the supplied issue screenshot.
- Cloud identity block: compared directly in the combined image; serif Latin display, Chinese secondary label, divider rule, monospaced altitude line, and quieter Chinese science note preserve the source hierarchy.
- Main imagery: compared directly in the combined image. The background crop, upper-right sunlight, blue atmosphere, distant ridge line, and lower cloud sea match the source art direction. The central cloud now uses a live ray-marched implicit surface with calculated normals, producing a crisp silhouette and visibly separated lobes while preserving Web 3D interaction.

## Required fidelity surfaces

- Fonts and typography: passed. Baskerville/Times-style serif display, Songti-style Chinese display, and monospaced interface labels reproduce the source hierarchy and tracking. Text remains readable without overlap in the tested desktop and mobile states.
- Spacing and layout rhythm: passed. Rail, lowered cloud title, scale marker, and open lower edge retain the sparse full-screen rhythm after the requested removal of the orbit ellipse and progress axis. Narrow-screen adaptation moves the horizontal cloud selector down with the title so the two regions do not overlap.
- Colors and visual tokens: passed. Bright azure, warm ivory sunlight, translucent white guides, and navy typography align with the source palette. The procedural surface keeps white highlights while using pale-blue normal shading to separate individual lobes.
- Image quality and asset fidelity: passed. A dedicated photorealistic high-altitude background replaces the previous dark gradient. The central cloud remains programmatic to preserve the requested Web 3D interaction.
- Copy and content: passed. Eight cloud levels use bilingual meteorological names, concise English descriptors, plausible altitude bands, and a distinct Chinese note covering formation, appearance, or common weather signals.

## Findings

- [P3] Real-time cloud highlights remain more stylized than the reference photograph.
  - Location: central WebGL cloud surface.
  - Evidence: the source uses photographic multiple scattering; the implementation calculates an interactive implicit surface and normal-based lighting in real time.
  - Impact: the cloud is now crisp and dimensional, but its brightest ridges are cleaner and more graphic than the photographic source.
  - Follow-up: add a subtle subsurface-scattering pass if higher-end GPU performance is an acceptable trade-off.

## Comparison history

1. Initial pass found two P2 issues: the cloud taxonomy switched to a horizontal strip too early at the available narrow-desktop width, and Stratocumulus appeared as a flat gray layer. Fixed by moving the responsive breakpoint to 620 px and replacing the layer field with multiple connected volumetric cells.
2. Interaction pass found a P2 collision between the lower cloud labels and the cloud identity block when Cumulonimbus was selected. Fixed by shortening the rail to 60% of viewport height and widening the identity block so long Latin names remain on one line.
3. Final pass confirmed those P2 issues no longer appear in the desktop or 390 × 844 responsive evidence. No P0, P1, or P2 findings remain.
4. White-cloud refinement responded to the user's note that the live cloud looked too gray. Raised the volumetric shadow floor, reduced atmospheric color contamination, and increased density/opacity so the cloud reads as white while keeping enough pale-blue occlusion to preserve depth. The browser console remains clean.
5. Volume-and-clarity pass responded to the request for stronger depth, sharper rendering, a larger default cloud, and no orbit ellipse. Increased ray samples from 52 to 64, tightened the density threshold, added high-frequency breakup, strengthened two-depth self-shadowing, increased the default scale by moving zoom from 1.0 to 0.90, and removed the ellipse element. Post-fix evidence confirms the cloud is larger and more articulated, the drag text remains, no `.orbit` element is present, and the browser console has no warnings or errors.
6. Sharp-surface pass responded to the remaining blur and the request to remove the bottom progress axis. Replaced translucent density accumulation with a 96-step iso-surface search, four-step hit refinement, calculated surface normals, self-occlusion, and aspect-aware framing. Removed the timeline markup, styles, and button generation. Post-fix desktop and 390 × 844 evidence shows a crisp silhouette, distinct cloud lobes, no bottom axis, eight working cloud selectors, and no browser warnings or errors.
7. Layout, randomness, and drag pass moved the title/description block from 22% to 13% above the desktop bottom and repositioned the mobile title and selector into the newly open lower space. Cirrocumulus and Altocumulus now use hashed two-dimensional cells with randomized width, depth, height, and local offsets instead of uniform repeated strips. Global text selection is disabled, the information overlay no longer captures pointer input, and canvas drag handlers prevent default selection. Post-fix evidence confirms both cloud types are visibly irregular, desktop/mobile content remains separated, a drag starting over the title leaves `getSelection()` empty, and the browser console is clean.
8. Rail-alignment and science-copy pass corrected the inactive dot offset from -4 px and the active dot offset from -3.5 px, placing every dot center exactly on the 50 px rail. Added one concise Chinese science note for each of the eight cloud types and positioned it independently beneath the existing metadata so the title remains at its requested lower position. Post-fix evidence confirms all dot-center deltas are 0 px, all eight notes update with selection, the 390 × 844 layout has no page overflow or collision, and the browser console is clean.

## Implementation checklist

- [x] Full-bleed sky asset integrated.
- [x] Eight interactive cloud types available.
- [x] Eight concise Chinese science notes available.
- [x] Navigation dots centered on the taxonomy rail.
- [x] Drag-to-orbit and wheel zoom retained.
- [x] Density and sunlight controls retained in a compact disclosure.
- [x] Desktop and mobile layouts verified.
- [x] Browser warning/error log checked.

## Follow-up polish

- Optional P3: add a subtle subsurface-scattering approximation for softer photographic light transmission without reintroducing blurry edges.

final result: passed
