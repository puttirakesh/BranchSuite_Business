# Screen completion checklist

21 feature routes found: 3 auth, 18 workspace. Shared design changes affect all routes. Deep links reuse complete list/editor screens. Role gates remain on each workspace route; support uses the same shell, not a duplicate app.

UI-ready means interactive UI with validation; it does not imply the backend supports persistence. All preview writes are session-only and labeled.

| Route | Initial implementation | Changes / final UI | Live capability |
|---|---|---|---|
| `/login` | Complete | Business tokens, responsive controls preserved | Login/me/logout exist |
| `/forgot-password` | Form, integration error | Shared design retained | Platform reset request missing |
| `/reset-password` | Form, integration error | Shared design and password validation retained | Platform reset verification missing |
| `/dashboard` | KPI/modules/activity, partial metrics | Revenue/customer snapshot bars; support-specific summary; no unauthorized customer query | Summary exists; MRR, trials, attention absent |
| `/customers` | Search and cards | Pagination, account filter, page sorting; support access limitation explained | Admin list/search/status filter exist |
| `/customers/[id]` | Details, usage, companies, tickets/invoices, confirmation | Subscription calendars/range validation; truthful preview status changes | Admin details/status update exist; licence update absent |
| `/plans` | Pricing cards/editor | Business surface/control styling; existing limits/features validation preserved | Platform plan API absent |
| `/plans/create` | Shared editor deep link | Same complete create form | Preview only |
| `/plans/[id]` | Shared editor deep link | Same complete detail/edit workflow | Preview only |
| `/billing` | Summary, filters, CSV | Calendar ranges, pagination, page CSV error handling; overdue page scope explained | Summary/list/date/status filters exist |
| `/billing/[id]` | Invoice document, PDF integration notice | Shared styling; unknown discounts no longer displayed as zero; payment copy corrected | Detail exists; PDF/settlement absent |
| `/support` | Search/status list | Pagination and shared styling | Both roles authorized |
| `/support/[id]` | Conversation/composer | Independent status/priority save, closed-ticket guidance; replies retained | Public reply and admin status/priority exist; notes absent |
| `/marketing` | Search/stage | Provider stage/date filters before pagination; follow-up calendars | Platform prospect API absent |
| `/marketing/[id]` | Details/contact links/follow-up form | Follow-up uses shared calendar; form/discard retained | Preview only |
| `/offers` | Offer and campaign lists/editors | True lifecycle status, start/expiry calendars; campaign schedule; redemption claims removed | Offer definitions exist; campaigns absent |
| `/offers/create` | Offer editor deep link | Start/end bounds and validation | Create exists; disabled creation stays DRAFT |
| `/offers/[id]` | Offer editor deep link | Preserve start date; obey draft/paused edit rules and skip no-op transitions | Update/status exist; archived terminal |
| `/settings` | Brand/email/trial form | Support phone, HTTPS portal, announcement/display controls; reset/save retained | All except trial control supported |
| `/audit` | Event cards/search/date text | Calendar range, pagination, local event detail sheet; exact action label | List/detail/summary/modules exist |
| `/more` | Authorized module tiles | Business shared tokens and navigation styling | Capability filtered |

Additional dialogs preserved: account/preview-role switch, module search, quick actions, customer status confirmation, subscription, plan, offer, campaign. Added calendar dialog and audit event detail sheet. Infrastructure routes: `/` redirect and `+not-found`.

Remaining backend-dependent workflows are intentionally unavailable in connected mode; none have been replaced with invented results. Native device testing, full server sorting, server-wide overdue filtering, PDF export and payment confirmation require follow-up work described in BACKEND_ENHANCEMENT_REPORT.md.
