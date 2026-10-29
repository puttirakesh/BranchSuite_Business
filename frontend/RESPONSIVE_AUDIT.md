# Responsive and UX audit — 27 October 2026

## Additional component and breakpoint review

This review extends the viewport matrix to 320, 390, 640, 768, 1024, 1200, 1366, and 1920px, including the sidebar transition at laptop widths. Existing workspace edits were preserved.

- Record grids now respect their 280px minimum card width after sidebar and page padding, even at the default font size. Dashboard tile counts retain their existing behavior.
- Employee web selectors use the shared portal dropdown with arrow-key navigation, Escape, and focus return. Opening a selector no longer moves the rest of the form. Unavailable selections retain their error state.
- Long dropdown option names wrap instead of hiding their distinguishing text behind an ellipsis.
- Narrow phone calendars reclaim horizontal space, use taller day targets and 44px month controls, and keep floating captions clear of the border.
- Compact summary labels use 12px text. Employee section headers and metadata rows can wrap, and the main employee content can shrink inside its shell.
- The payroll return dialog has a bounded height and scrollable content, with reachable actions in short landscape windows. Its keyboard container explicitly retains Android window-resize behavior.
- Advance payout actions use the shared web accent, sizing, spacing, and disabled feedback. Shared app buttons also block activation while busy and allow long labels to wrap.
- Responsive small-text adjustments preserve earlier width constraints instead of restoring the original oversized styles.

Regression coverage adds laptop record-card sizing, long branch names, populated employee selectors without layout movement, open calendars, and a payroll dialog in a 640x360 window. The long-name check was confirmed to fail against the original export before rebuilding.

The existing fixture and physical-device limitations below continue to apply. Generated screenshots show the visible scroll area; they do not establish visual coverage of every offscreen form section or every populated/error state.

## Visual consistency followup

The second pass reviewed rendered screenshots rather than treating overflow checks as a visual-design assessment. It corrected touching task fields, uneven task panels, stretched customer forms, unpadded advance presets, inconsistent field typography and button shapes, and an empty leave selector incorrectly showing an unavailable-option error.

- Shared web inputs now use a readable 14px minimum text size and 10px corners. Requested field heights and multiline editing space are respected, and floating labels remain attached to the border at those heights.
- Shared action styles use consistent corners, padding, centered labels, and readable text. Employee phone/tablet styles lift small copy using the existing typography helper.
- Task fields have 16px gaps on mobile; tablet/laptop task panels align along their lower edge.
- Customer forms use two columns when the available content width permits, stack on phones, and keep actions together at the bottom. Salary-advance forms have a bounded width, and preset amounts have proper padding and centered text.
- Leave, leave application, and attendance-history panels are centered on wider screens. Their action text matches other forms. Empty leave choices are disabled without presenting a stale-selection error.
- The sales-pipeline Cancel action uses a neutral style, and its primary action uses the shared blue.

This pass covers **81 route cases at 320, 390, 768, 1024, and 1366px**. The complete sweep passed **405 checks**, with screenshots captured for every case. **25 final-build reruns** verify the last color and alignment adjustments. **97 unit tests** and **14 browser workflow scenarios** pass across the suite and targeted reruns. Type checking and web export pass. Consolidated results are in `dist/responsive-audit/verified-results.json`.

Open `dist/responsive-gallery.html` to filter screenshots by route and width. Recreate it after an audit with `node scripts/build-responsive-gallery.cjs`. `AUDIT_SCREENSHOTS=all` captures every route; the default captures representative screens and layout failures. The original audit below records the first pass; this section describes the later visual changes. The same mocked-data and device-testing limits still apply.

## Scope

Reviewed the Expo frontend's authentication, admin, employee, shared navigation, form controls, and responsive styling. Browser coverage discovers every `.tsx` page under `app`, excludes layout wrappers and root redirects, substitutes fixture IDs for detail routes, and expands the CRM module routes across leads, customers, deals, quotes, activities, and support.

The layout matrix contains **81 route cases at five widths: 320, 390, 768, 1024, and 1440 pixels** (405 route/viewport combinations). The 1024px case uses a 768px height to exercise tablet landscape. Authentication, owner, and employee sessions use intercepted API fixtures. Redirect destinations are included in the JSON report.

## Issues corrected

| Area | Finding | Change |
| --- | --- | --- |
| Payroll inputs | The empty-state card extended beyond the content area at 320px and was clipped by its container. | Bound the card to the content width and allow its text to wrap. |
| Employee creation | The wizard controls were 32–34px high. | Increased their minimum height to 44px. |
| Password inputs | The visibility control was only 38px wide. | Shared visibility controls now have a minimum 44 × 44px target. |
| Signup | The icon back control was 16 × 32px; the sign-in link was 33px high. | Added 44px targets and a button role for the sign-in control. |
| Subscription plans | The back and billing controls lacked accessible button semantics. | Added labels, billing pressed state, and 44px targets. |
| Password reset | Several actions lacked button semantics. | Exposed the resend, new OTP, and return actions as buttons. |
| Personal leave | The request refresh control was only 42 × 16px. | Added an accessible name and a minimum 44 × 44px target. |
| Shared web dropdown | Keyboard users had no arrow navigation or predictable focus return; the menu could exceed a narrow viewport. | Added keyboard opening, arrows, Home/End, Enter/Space selection, Escape, Tab dismissal, focus return, viewport width limits, and visible portal focus styles. Search is at least 44px high. |

## Validation and artifacts

Final results: **405/405 route/viewport cases pass** after merging the complete layout scan with final-build reruns of seven affected routes (35 additional checks). No measured horizontal page overflow, out-of-viewport content, controls below the audit's 40px threshold, or uncaught page errors remain in these cases. The specific controls enlarged in this change have 44px targets; the audit threshold does not certify all controls as 44px.

Type checking and web export pass. All **96 unit tests** pass. The **13 existing browser scenarios** pass across the suite run and the corrected employee-payroll rerun; the new layout audit and interaction scenario also pass. The payroll rerun verifies that a month dropdown remains usable after closing a payslip modal, including history, PDF downloads, and error recovery.

- `npm run typecheck` — TypeScript validation.
- `npm test` — existing unit checks, including responsive grid/font-scale calculations and native keyboard/safe-area contracts.
- `node --test tests/responsive-audit.browser.cjs` — route matrix, overflow/clipping, runtime errors, small control targets, JSON results, and representative screenshots.
- `node --test tests/responsive-controls.browser.cjs` — targeted touch dimensions, billing state, payroll empty state, and real dropdown keyboard behavior at phone/tablet widths.
- Existing browser tests exercise dashboard breakpoints, role navigation, authentication/OTP, validation, attendance/leave, payroll, PDF downloads, sidebars, and task filters.

Generated layout results and screenshots are in `dist/responsive-audit/`. Targeted reruns using `AUDIT_ROUTES` write to `dist/responsive-audit-followup/`. Export the web app before running browser tests; do not rebuild while a browser run is using `dist`.

`dist/responsive-audit/verified-results.json` consolidates the full scan and final-build reruns, with the latest result for each route/width. The original `results.json` preserves the full scan, including the two small targets subsequently corrected and verified by the followup. Representative screenshots were visually reviewed for phone and tablet layouts.

Example focused rerun in PowerShell:

```powershell
$env:AUDIT_ROUTES = '/auth/signup,/admin/my-leave'
node --test tests/responsive-audit.browser.cjs
Remove-Item Env:AUDIT_ROUTES
```

## Limits and remaining verification

This establishes layout behavior for the tested fixtures and interactions. It does **not** establish that every possible screen state is free of UX issues.

- The broad scan primarily exercises empty lists, representative identity/task data, and initial form states. Existing workflow tests cover selected populated states and dialogs. Large production datasets, unusually long content, every dialog, and every server error still need additional coverage.
- Chromium/Edge emulation is not physical Android/iOS testing. Check on-device keyboards, safe areas, rotation, native dropdown placement, printing/sharing, and iOS Safari separately.
- Unit coverage checks enlarged-text grid calculations; it is not a full screen-reader, contrast, browser zoom, or native large-font accessibility audit. Some compact labels remain small and merit a readability review.
- Invitation acceptance and CRM Support explicitly show unavailable states in the current product. Their layouts can be checked, but those workflows cannot be certified as functional.
- API responses are mocked, so these checks do not validate live backend authorization, email delivery, real uploads/download services, or production performance.

Existing workspace changes were retained. No production business records were changed by this audit.
