# Shared design system

Authoritative references: `frontend/src/shared/theme/colors.ts`, `frontend/src/ui/webWorkspaceStyles.ts`, `frontend/src/ui/iconAccent.ts`, `moduleIconColors.ts`, `AppIcon.tsx`, `AppIcon.web.tsx`, `app-icon-symbols.ts`, `WorkspaceNavigation.tsx`, and `DashboardWebHeader.tsx`.

SuperAdmin owns its adapted components; no application imports reference `frontend/`. Business code is unchanged.

| Role | SuperAdmin token / value |
|---|---|
| Brand / pressed | `primary` #3157D5 / `primaryPressed` #2445B4 |
| Page / panel | `bg` #EDF2FA / `surface` #FFFFFF |
| Main / secondary text | `ink` #1B2D4A / `muted` #586D8B |
| Borders / success / danger | #D6E0EF / #138F80 / #B94D61 |
| Sidebar | #101D35, adapted from Business web workspace |
| Control / panel radius | 10 / 14, from Business web tokens |

Retain the existing semantic blue/lavender/mint/amber accents for modules and statuses. Purple may be a module accent, while primary actions and selections use blue. `src/theme/iconAccent.ts` adapts Business pastel module accents for the navy sidebar. `Icon.tsx` renders cohesive Feather-compatible 24-unit outline paths through the existing react-native-svg dependency, at 2-unit stroke width. Decorative SVGs are hidden from assistive technology. Functional chevrons and action icons retain their explicit semantic color. No icon font dependency or emoji icons were added.

Shared components retained: Button, FieldShell/TextField, SelectField, CheckboxField, Cards, Headers, StatCard, ModuleCard, Tile, UsageCard, MoneyRow, DetailList, Note, Pill, loading/error/empty/query states, toast, Grid, Screen, ListScreen, WorkspaceLayout and Sheet/ConfirmDialog. Added DatePickerField and web dialog focus management. The dashboard adds lightweight labeled snapshot bars without a chart library.

Native and web use the same typography hierarchy, white surfaces and light page background. Buttons have a 44px minimum touch target, wrapping labels, consistent labels/errors and busy/disabled states. Form controls retain 50px height where existing layouts benefit from it.

At 560px content can use two columns; desktop sidebar begins at 1000px and wide layouts at 1320px. Headers stack on phones, long lists stay virtualized, and dialogs scroll with constrained heights. Sidebar content scrolls on short windows. Bottom navigation retains safe-area padding. Calendar grids use seven proportional columns and adjust padding for narrow/short screens.

`Blocks.tsx` and the unrelated comment removal in `Screen.tsx` have existing workspace edits; preserve them. Shared tokens update their presentation without replacing functional blocks.
