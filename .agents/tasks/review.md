# Admin Payment Approval Workflow for Agent Packages

Agent package purchases now flow through an approval process. Agents submit payment proof, admins review and approve/reject in a dedicated UI, and agents receive notifications of the outcome. Package activation is automatic on approval.

The implementation adds notification types for package approval and rejection, ensures the admin dashboard routes approvals to a dedicated component, and surfaces outcomes to agents through the notification system.

**Watch for:** Package activation occurs without verifying that the payment message actually matches an M-Pesa deposit — the workflow trusts admin judgment. Agents can only have one pending purchase at a time, but if rejection happens and the admin forgets to tell them why, the UI shows it but there's no automated notification. The profile picture persistence issue mentioned in the user context is separate from this change.

**Verdict**: APPROVED

## High-level view

The approval flow is implemented end-to-end: agents submit pending purchases with M-Pesa payment messages, admins fetch all pending purchases in a dedicated UI with approve/reject actions, and the backend updates agent package status and creates notifications. The Notification model adds two new types (package_approved, package_rejected) with message and agentPackageTier fields to capture the package tier being approved. Endpoints are properly gated to admin-only for approval/rejection. The agent frontend displays these notifications with contextual styling (green for approved, red for rejected). The implementation prevents concurrent pending purchases through explicit status checks. However, payment verification is entirely manual—there's no automated M-Pesa API integration to confirm the payment message references a real deposit, so admins must verify this themselves before approving.

<details>
<summary>Issues (2)</summary>

1. **No M-Pesa verification** — Payment messages are trusted without automated validation against actual M-Pesa deposits. Admin must manually verify legitimacy.
2. **Silent rejection without notification delivery** — Rejected status is stored but the frontend does not actively push/email the rejection reason to the agent.

</details>

<details>
<summary>Details</summary>

### Package Approval Triggers Immediate Activation

When an admin approves a pending purchase via PUT `/api/agents/approve-purchase/:userId`, the backend activates the package immediately by setting `subscriptionTier`, `subscriptionExpiresAt`, `packageAmount`, and `packageHistory`. The expiry date is calculated via `calculateExpiryDate()` from the package config. This is correct behavior for a one-step approval model—the package is live as soon as admin confirms. A notification of type `package_approved` is created with the tier name and expiry date embedded in the message, and status is set to `confirmed`. This ensures agents see the outcome and know when their benefits expire.

### Rejection Preserves Reason and Changes Status

The PUT `/api/agents/reject-purchase/:userId` endpoint marks the purchase as rejected, stores the admin-provided reason in `rejectionReason`, records the review timestamp and admin ID, and creates a `package_rejected` notification. The notification message includes the rejection reason or a default string if the admin didn't provide one. This is a clean audit trail, though delivery to the agent is passive—they only see it if they navigate to the Notifications page. There is no active email or push notification sent to alert them of rejection, so the agent may not realize their purchase was declined without checking the dashboard.

### Admin UI Fetches and Displays Pending Purchases

The PaymentApprovals component (admin frontend) calls GET `/api/agents/pending-purchases` on mount, which returns agents with `agentProfile.pendingPackagePurchase.status === "pending"`. The table displays agent name, email, phone, package tier, amount, payment reference (truncated to 20 chars with tooltip), and submission date. Approve and Reject buttons send PUT requests to the respective endpoints. A modal prompts for an optional rejection reason before submitting. Successful actions remove the row from the table. The component properly disables buttons while requests are in flight and shows success/error feedback. The admin dashboard integrates this component under the "payment" tab.

### Agent Notifications Recognize New Types

The agent NotificationsPage.jsx maps `package_approved` to "Package Approved" title and `package_rejected` to "Package Rejected", displays the message field from the notification document, and applies color coding (green for approved, red for rejected). The notifications merge server-fetched notifications with local storage, so they persist across sessions. The notification system is UI-only; it does not auto-dismiss or require action.

### Concurrent Purchase Prevention

Before creating a new pending purchase, the backend checks if `user.agentProfile.pendingPackagePurchase.status === "pending"` and rejects the request with a message telling the agent to cancel the existing purchase first. This prevents the confusion of multiple awaiting purchases. The cancel-pending-purchase endpoint sets status to `cancelled` and records `cancelledAt`, allowing a new purchase to be submitted afterward. This state machine is well-defined.

### Notification Model Accepts New Types

The Notification schema enum for `type` includes `package_approved` and `package_rejected`. New fields `message` and `agentPackageTier` are added to the schema without defaults, so both are optional but present when created by the approval/rejection flow. Existing notification types remain unaffected. No migrations are needed because MongoDB schemas are flexible.

### Payment Verification Gap

The approval process trusts the payment message text provided by the agent without validating it against M-Pesa API or transaction logs. An admin approving a purchase sees the M-Pesa message string but has no automated way to confirm it references a real, matching deposit from the correct phone number. This is a business-level risk: a malicious actor (or a confused user copying the wrong message) could submit a fake message and the admin could approve it without knowing. The fix would require integration with the M-Pesa API to confirm the reference exists and the amount matches. For now, admins must manually verify via M-Pesa portal or rely on procedural checks outside this system.

### No Active Rejection Notification Delivery

When a purchase is rejected, a notification is created in the database with the rejection reason, but the agent is not actively notified—no email is sent, no push alert fires. The agent sees the rejection only by navigating to the Notifications page or if they refresh their pending purchase status. If the admin rejects without explanation or the agent does not check notifications, they may resubmit the same payment, leading to friction. A simple fix would be to call an email or push service when creating the rejection notification, or to add a read receipt / mark-as-seen flow that prompts the agent when they log in.

</details>

## File map

<details>
<summary>Files changed</summary>

- **models/Notification.js** — Added `package_approved` and `package_rejected` to type enum; added `message` and `agentPackageTier` fields.
- **routes/agents.js** — PUT `/api/agents/approve-purchase/:userId` activates package and creates approval notification; PUT `/api/agents/reject-purchase/:userId` marks rejected and creates rejection notification; GET `/api/agents/pending-purchases` filters agents with pending status.
- **axxspace-admin/src/components/PaymentApprovals.jsx** — New component fetches pending purchases, displays table, handles approve/reject modals and API calls.
- **axxspace-admin/src/pages/AdminDashboard.jsx** — Imported PaymentApprovals and rendered under `activeTab === "payment"`.
- **src/pages/NotificationsPage.jsx** — Added handling for `package_approved` and `package_rejected` types; maps to titles, messages, and colors.

</details>
