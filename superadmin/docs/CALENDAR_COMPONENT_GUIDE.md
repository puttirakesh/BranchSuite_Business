# Calendar component guide

`src/shared/components/DatePickerField.tsx` adapts the Business `frontend/src/ui/DatePickerField.tsx`. It uses existing React Native and SVG components: no new date dependency is required.

```tsx
<DatePickerField label="From" value={from} onChange={setFrom}
  maxDate={to || undefined} clearable />
<DatePickerField label="To" value={to} onChange={setTo}
  minDate={from || undefined} clearable />
<FormDate control={form.control} name="followup" label="Next follow-up" required />
```

The field is a button with a calendar icon, not a TextInput. Pressing opens a responsive calendar with month navigation, disabled out-of-range days, current selection, Today, optional Clear date, and Close. Required FormDate fields default to non-clearable. FormDate integrates React Hook Form validation and blur/touched state through Controller and FieldShell.

Props: label, value, onChange, minDate/maxDate (`YYYY-MM-DD`), disabled, clearable, hideLabel, placeholder, style. Empty optional dates use `''`. Display uses `en-IN`, for example `04 Nov 2026`; stored values remain date-only strings. Invalid values and reversed/invalid bounds surface an error, and unavailable dates cannot be selected.

`core/domain/dates.ts` parses using local year/month/day components at noon and serializes those components, avoiding UTC conversion of local midnight. Calendar arithmetic handles leap years and month boundaries. Backend offer timestamps explicitly use UTC start/end-of-day boundaries; billing and audit filter contracts define inclusive UTC calendar days. Do not pass a timestamp directly into the date-only component. A future appointment time must use a separate time control and an explicit timezone contract.

Accessibility: labeled Pressables, selected/disabled state, live month announcements, 44px day height, native Modal semantics and hardware-back dismissal. Web dialogs trap Tab, restore opener focus, close with Escape, and support arrow navigation between visible day cells. Enter/Space activates focused buttons. At month edges use the Previous/Next month buttons; automatic arrow rollover across months is not implemented. Native screen-reader/device verification remains outstanding.

## Coverage

Eight existing text inputs replaced:

1. Subscription renewal/due date (`SubscriptionEditor`).
2. Subscription trial end (`SubscriptionEditor`).
3. Prospect next follow-up (`ProspectDetailsScreen`, via FormDate).
4. Offer expiry (`OfferEditor`).
5. Billing issue date From.
6. Billing issue date To.
7. Audit From.
8. Audit To.

Five added date controls: offer start; campaign start/end; marketing follow-up From/To. Total: 13 calendar fields across 7 forms/filter surfaces. No date-only text field remains. Subscription renewal cannot precede trial end; offer expiry and campaign end cannot precede their starts; all filter ranges constrain both endpoints. Schemas independently enforce ranges at submit time.

Tests: calendar.test.ts covers parsing, leap days, local serialization, min/max inclusivity, invalid bounds and form ranges. workspace.browser.cjs exercises actual dialog opening, date selection, disabled earlier days, clear, Escape, form errors, routes and responsive widths. Browser tests require a separately exported preview build; see IMPLEMENTATION_SUMMARY.md.
