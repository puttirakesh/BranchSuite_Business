# Employee dashboard handoff

The employee route now implements the APK's My work dashboard: greeting, today's attendance, leave balance shortcuts, assigned task count and next tasks, latest take-home pay, and profile details. Navigation opens read-only attendance, task, pay, leave balance and profile sections. Attendance check-in and check-out send API requests and reload the dashboard after server confirmation. Leave submission, task editing, attendance history, full payslip history and PDF export are separate workflows not implemented by this dashboard.

The NestJS backend currently only exposes health checks. Implement the following contract to enable this dashboard with live employee accounts. Missing endpoints display an unavailable state with retry; the UI does not substitute sample data.

All endpoints are relative to `/api/v1`. Requests include the bearer token plus `X-Tenant-Id`, `X-Company-Id`, and `X-Branch-Id`. The server must validate membership and branch scope, derive employee identity from the authenticated account, and return only that employee's records. The dashboard does not require business CRM permissions. Payroll responses must exclude unpublished drafts.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/employee/dashboard` | Return the JSON object below. |
| POST | `/employee/attendance/check-in` | Accept `{}`; record the server timestamp and return success. |
| POST | `/employee/attendance/check-out` | Accept `{}`; record the server timestamp and return success. |

Attendance writes should reject duplicate or invalid transitions with 409 and enforce the current scheduled workday. The server owns the workday date, shift and timestamps. Refresh returns the saved state; the client does not optimistically record attendance. Use 401 for expired tokens and 403 for unauthorized scope.

```json
{
  "date": "2026-10-07",
  "profile": { "employeeId": "EMP-001", "designation": "Executive", "department": "Operations", "manager": "Neha Iyer", "joinedOn": "2025-04-01" },
  "attendance": { "status": "NOT_CHECKED_IN", "shift": "09:00 – 18:00", "checkedInAt": null, "checkedOutAt": null },
  "leave": { "casual": 8, "sick": 5, "pendingRequests": 1 },
  "tasks": [{ "id": "task1", "title": "Follow up with Sunrise Academy", "status": "TODO", "dueAt": "2026-10-07T10:00:00Z" }],
  "latestPayslip": { "id": "pay1", "period": "September 2026", "netPay": 28500, "currency": "INR", "status": "PAID" }
}
```

Attendance status: `NOT_CHECKED_IN`, `CHECKED_IN`, `CHECKED_OUT`, `ON_LEAVE`, or `HOLIDAY`. Task status: `TODO`, `IN_PROGRESS`, or `COMPLETED`; tasks must be ordered by priority/due date. Pay status: `PUBLISHED` or `PAID`. Use `tasks: []` and `latestPayslip: null` for empty states. Shift, manager, joining date and task due date may be null. Dates are ISO calendar dates; timestamps include UTC or an explicit timezone offset and display in the device's timezone.

Implementation: `src/screens/EmployeeDashboardScreen.tsx` and `src/services/employee.ts`. Browser tests use intercepted API responses to validate scoped requests, navigation, attendance success/failure, retry, empty states and responsive layouts. Live backend authorization still requires backend testing.
