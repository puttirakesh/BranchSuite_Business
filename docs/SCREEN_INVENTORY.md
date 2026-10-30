# Screen inventory

| Existing route | BranchSuite APK screen |
| --- | --- |
| `(auth)/login` | Admin sign-in, password visibility, sample owner/support accounts |
| `(auth)/forgot-password`, `reset-password` | Local-demo recovery explanation and return to sign-in |
| `(admin)/dashboard` | Platform overview, metrics, modules and priority queue |
| `(admin)/customers`, `[id]` | Customer search, usage, subscription details and editor |
| `(admin)/plans`, `[id]`, `create` | Pricing, limits, modules and plan editor; new plan creation added |
| `(admin)/billing`, `[id]` | Subscription invoices, details and PDF export |
| `(admin)/support`, `[id]` | Tickets, conversations, replies, internal notes and status changes |
| `(admin)/marketing`, `[id]` | Sales prospects and follow-up editor |
| `(admin)/offers`, `[id]`, `create` | Offers, coupon editor and campaign management |
| `(admin)/settings` | Branding, support address and demo trial toggle |
| `(admin)/audit` | Locally recorded platform changes |
| `(support)/dashboard`, `customers`, `support` | Same APK screens with its restricted support role |

The source APK includes additional business/employee code because it shares a product codebase. Admin mode and the original permission checks remain enabled; tenant employee workspaces are not exposed by this admin app.
