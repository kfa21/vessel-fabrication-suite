# Vessel Fabrication Suite

Manufacturing package for the 28 columns, drums, receivers and treaters in the three UOP
Project Specification 301 packets supplied with the inquiry:

| Unit | Spec | Items |
|---|---|---|
| Fixed-Bed Platforming | 9135752-301 (rev 0, 04-SEP-26) | 11 |
| Naphtha Hydrotreating | 9135751-301 (rev 0, 21-AUG-26) | 9 |
| Par-Isom | 9135753-301 (rev 0, 04-SEP-26) | 8 |

## What it does

| Tab | Content |
|---|---|
| Register | Fleet roll-up, per-unit tonnage/value, PWHT count, clickable equipment register |
| **Equipment summary** | Tag matrix (each equipment tag is a column, every detail a row) with filters for type, orientation, support, PWHT and tag/service. Thickness rows show shell, upper shell, top dish end, bottom dish end, cone and drop leg as **calculated → next market plate gauge**. Below the matrix, one part schedule per equipment in the shop's table form (Equipment Part / Qty / Unit / Material / Note) with CSV exports for both |
| Design & 3D | Parametric Three.js model built from the real plate plan — vertical **or horizontal**, 2:1 heads, cone transitions, nozzles/manways placed on the correct clock line, WD trays with downcomers, packing beds, catalyst beds with grids/distributors, baffles, saddles or skirt/legs, vacuum stiffeners, drop legs. Weld layer shows Category A longitudinal seams (one per plate, staggered per UW-9), Category B girth seams and head closures at the true course heights. Cutaway / internals / weld / transport-saddle layers, fit-end-mid-end presets, ASME VIII Div.1 thickness sheet, UG-28 vacuum screening, UG-37 nozzle reinforcement, datasheet nozzle schedule |
| Material / BOQ | Plate nesting alternatives (min-cost optimisation), shell course breakdown, weight take-off, fleet procurement by gauge, baseline vs optimised BOQ with saving |
| Part plan | Individual part register per vessel (shell, heads, nozzles, manways, internals, support, attachments, lining) with CSV export and forming notes |
| Weld plan | Joint register by ASME category, joint detail, process, deposition and hours, process mix, preheat/quality controls, welding sequence |
| NDT plan | Method/extent/stage/acceptance per joint category (UW-11/UW-51/UW-52), hold points, hydrotest, hardness and PMI requirements |
| PWHT | Manual **Push to PWHT furnace** toggle (header switch or hero button), UCS-56 cycle, furnace chart, charge schedule, post-PWHT NDT, cost and schedule impact |
| Manufacturing | Shop Gantt, stage/resource/hold-point table, critical path, transport sections and transportation saddles, ITP sign-off matrix, CSV export |

Every number on the page is derived from the datasheet values (ID, T/T, design pressure,
vacuum, corrosion allowance, material, heads, class, RT policy, PWHT flag, nozzles, trays/packing).

## Orientation and supports

Each item carries an explicit axis. Columns, separators, treaters and the vertical drums sit on a
skirt or legs; six items are horizontal drums/receivers on **two saddles** (one fixed, one sliding):
12-D10, 10-D03, 10-D06, 11-D01, 11-D05 and 11-D06.

- Horizontal equipment is modelled lying down, with saddle assemblies (curved top plate, two webs,
  base plate, anchor bolts) in the part plan, saddle-to-shell welds in the weld plan, MT of those
  welds in the NDT plan, and a transport note in the manufacturing plan.
- Every **vertical** item carries two temporary **transportation saddles** plus four tie-down lugs for
  road transport lying down (part plan, weld plan, MT after removal, manufacturing note). The 3D
  viewer has a *Transport saddles* mode that lays the vessel on those cradles.
- Orientation is a datasheet field, but it can be flipped per item in the Design tab; the permanent
  support, weights, welds and 3D follow immediately.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # type-check + production build
```

## Excel workbook

[`excel/Vessel-Fabrication-Suite.xlsx`](excel/Vessel-Fabrication-Suite.xlsx) is a single-vessel
calculator with the same engineering basis as the app, driven entirely by live Excel formulas. Enter
the datasheet in the yellow cells on **Input** and every result recalculates: no macros, no pasted
answers. It ships pre-filled with 12-C01 so the expected output is visible on opening.

| Sheet | Content |
|---|---|
| Input | Datasheet fields, design conditions, geometry, heads, boot and lining (the only sheet you edit) |
| Design | UG-27/32/34 thickness table with utilisation, MAWP back-calculation and the UG-28 external-pressure screen with ring spacing |
| Nozzles | Nozzle and manway schedule: neck, UG-37 area check, pad sizing, studs, flange and neck weights |
| Weights / Components | Weight build-up by group and the part schedule in the app's component grouping |
| Weld / Cost | Joint register, weld metal, arc and fit-up hours, then plate, consumables, labour, NDT, PWHT and paint |
| Summary | One page: design result, quantities, weight, cost, manhours and datasheet-ready text |
| Fleet / Lists | Static 28-vessel reference and every lookup table and rate |

The workbook is generated, not hand-edited: `excel/build-workbook.mjs` and its modules build every
sheet, style, validation and named range. Run `npm run excel` to regenerate the `.xlsx` after changing
a formula, a rate or the pre-filled example, so revisions stay reviewable as small diffs.

## Engineering basis and assumptions

- Thickness per ASME BPVC VIII Div.1: UG-27(c)(1)/(2), UG-32(d), UG-34(c)(1), UG-32(f) for the
  conical transition, UG-28 screening for full vacuum, UG-37/UG-45 for nozzle reinforcement.
- Allowable stress is an indicative SA-516 Gr.70 curve (138 MPa to 343 °C, falling above).
  **Verify against ASME II-D Table 1A for the purchased heat and final design temperature.**
- Corrosion allowance and radiography basis are taken from each sheet. Items shown as "MR"
  (manufacturer's responsibility) are resolved by explicit, visible assumptions:
  full RT is used where the sheet states Full; otherwise E = 0.85 (spot). The RT basis can be
  overridden in the Design tab and the effect on thickness, NDT extent and cost is immediate.
- PWHT defaults to the sheet: vessels flagged PWHT start queued; others can be pushed manually.
  Where a vessel is mandatory but toggled off, the page shows a specification hold.
- Each pressure part is sized and rounded on its own: shell, upper shell, top dished end, bottom dished end,
  cone and drop leg. The top head of a two-diameter column is sized on the upper diameter, not the lower one.
  Selected thickness is always shifted **up** to the next standard plate gauge (6, 8, 10, 12, 14, 16, 18, 20,
  22, 25, 28, 32, 36, 40, 45, 50, 56, 60, 65, 70, 80, 90, 100 mm), never down.
- Shop durations carry a 1.3 planning allowance on every stage plus a 10% contingency stage, so the
  manufacturing plan reads as a deliverable schedule rather than a best case.
- Weight take-off and costs are preliminary-engineering estimates from geometry, not a quoted BOQ.
- Exclusions: internals supply (trays/packing by others where noted), refractory, external
  insulation, heat tracing, transport, field erection, spares.
- Stamped U-1A calculation and client-approved drawing govern over this planning tool.
