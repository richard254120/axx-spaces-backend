# Implementation Plan: Admin Payment Approval Workflow for Agent Package Purchases

## Overview
This plan implements the complete workflow for admin payment approval of agent package purchases. Agents submit M-Pesa payment messages for package upgrades, admins review and approve/reject them, and agents receive notifications of approval (with automatic subscription activation) or rejection (with reason).

---

## Implementation Items

### 1. Backend: Update Notification Model to Support Package Notifications
**What to do:**
Add 'package_approved' and 'package_rejected' types to the Notification model enum. Add a 'message' field to store rejection reasons or approval details.

**Files:**
- `/home/oguda/Desktop/AXX/backend/axx-spaces-backend/models/Notification.js`

**Changes:**
- Add "package_approved" and "package_rejected" to the `type` enum
- Add optional `message: String` field for storing rejection reason or approval details

**Verify:**
```bash
cd /home/oguda/Desktop/AXX/backend/axx-spaces-backend
grep -n "package_approved\|package_rejected" models/Notification.js
```
Expected: Should show both types in the enum.

---

### 2. Backend: Enhance approve-purchase Endpoint to Create Notifications
**What to do:**
Modify the PUT `/api/agents/approve-purchase/:userId` endpoint in agents.js to call the `notifyUser` utility after approving the package, sending a 'package_approved' notification with the tier, amount, and expiry date.

**Files:**
- `/home/oguda/Desktop/AXX/backend/axx-spaces-backend/routes/agents.js`
- `/home/oguda/Desktop/AXX/backend/axx-spaces-backend/utils/userNotifications.js` (may need small update)

**Changes:**
- Import `notifyUser` from utils/userNotifications.js at the top of agents.js
- After `user.save()` in the approve-purchase endpoint, call:
  ```javascript
  await notifyUser(userId, {
    type: 'package_approved',
    title: 'Package Purchase Approved',
    message: `Your ${tier} package (KSh ${amount}) has been approved and activated. It will expire on ${expiresAt.toLocaleDateString()}.`
  });
  ```
- Ensure the Notification model can save this notification type correctly

**Verify:**
```bash
cd /home/oguda/Desktop/AXX/backend/axx-spaces-backend
grep -A 15 "PUT /api/agents/approve-purchase" routes/agents.js | grep -i "notifyUser"
```
Expected: Should show the notifyUser call present in the approve-purchase endpoint.

---

### 3. Backend: Enhance reject-purchase Endpoint to Create Notifications
**What to do:**
Modify the PUT `/api/agents/reject-purchase/:userId` endpoint in agents.js to call the `notifyUser` utility after rejecting the package, sending a 'package_rejected' notification with the rejection reason.

**Files:**
- `/home/oguda/Desktop/AXX/backend/axx-spaces-backend/routes/agents.js`

**Changes:**
- After `user.save()` in the reject-purchase endpoint, call:
  ```javascript
  await notifyUser(userId, {
    type: 'package_rejected',
    title: 'Package Purchase Rejected',
    message: `Your package purchase request has been rejected. Reason: ${reason || 'Payment verification failed'}. Please contact support for more information.`
  });
  ```

**Verify:**
```bash
cd /home/oguda/Desktop/AXX/backend/axx-spaces-backend
grep -A 15 "PUT /api/agents/reject-purchase" routes/agents.js | grep -i "notifyUser"
```
Expected: Should show the notifyUser call present in the reject-purchase endpoint.

---

### 4. Admin Frontend: Create PaymentApprovals Component
**What to do:**
Create a new React component `PaymentApprovals.jsx` that displays a professional table of pending agent package purchases with approve/reject actions.

**Files:**
- `/home/oguda/Desktop/AXX/backend/axx-spaces-frontend/axxspace-admin/src/components/PaymentApprovals.jsx` (new file)

**Features:**
- Fetch GET `/api/agents/pending-purchases` on component mount
- Display table with columns: Agent Name, Email, Phone, Package Tier, Amount (KSh), Payment Message, Submission Date
- Add Approve button (green) and Reject button (red) for each row
- Approve button directly calls PUT `/api/agents/approve-purchase/:userId`
- Reject button opens a modal/dialog to collect rejection reason, then calls PUT `/api/agents/reject-purchase/:userId` with `{reason}`
- Show loading states during API calls
- Show success/error messages after actions
- Refresh the pending list after each approval/rejection
- Professional styling (no emojis, clean table layout)
- Empty state message when no pending purchases

**Verify:**
```bash
ls -la /home/oguda/Desktop/AXX/backend/axx-spaces-frontend/axxspace-admin/src/components/PaymentApprovals.jsx
```
Expected: File should exist.

---

### 5. Admin Frontend: Add PaymentApprovals to AdminDashboard
**What to do:**
Integrate the PaymentApprovals component into the AdminDashboard by:
- Importing the component
- Adding "payment-approvals" tab to the TABS array (if not already present as "payment")
- Rendering the component when the active tab is "payment-approvals"

**Files:**
- `/home/oguda/Desktop/AXX/backend/axx-spaces-frontend/axxspace-admin/src/pages/AdminDashboard.jsx`

**Changes:**
- Import PaymentApprovals at the top
- Ensure the "payment" tab in TABS array is used or add "payment-approvals" if separate
- Add conditional rendering in the main content area to display PaymentApprovals when activeTab === "payment" (or "payment-approvals")

**Verify:**
```bash
grep -n "PaymentApprovals\|payment-approvals" /home/oguda/Desktop/AXX/backend/axx-spaces-frontend/axxspace-admin/src/pages/AdminDashboard.jsx
```
Expected: Should show import and rendering logic.

---

### 6. Admin Frontend: Update TabNavigation to Support Payment Approvals Tab
**What to do:**
Update the TabNavigation component to properly label and display the payment tab and show a badge if there are pending package purchases.

**Files:**
- `/home/oguda/Desktop/AXX/backend/axx-spaces-frontend/axxspace-admin/src/components/TabNavigation.jsx`

**Changes:**
- Add "payment-approvals" or ensure "payment" label is appropriate
- The component should accept `pendingCounts` which includes count of pending package purchases
- Display badge count (e.g., "Payment (5)") if there are pending approvals

**Verify:**
```bash
grep -n "payment" /home/oguda/Desktop/AXX/backend/axx-spaces-frontend/axxspace-admin/src/components/TabNavigation.jsx
```
Expected: Should show payment tab label and count badge logic.

---

### 7. Admin Frontend: Calculate and Pass Pending Package Purchase Count
**What to do:**
In AdminDashboard.jsx, fetch the count of pending package purchases and pass it to TabNavigation so it displays a count badge on the payment tab.

**Files:**
- `/home/oguda/Desktop/AXX/backend/axx-spaces-frontend/axxspace-admin/src/pages/AdminDashboard.jsx`

**Changes:**
- Add state for `pendingPackagePurchasesCount`
- In the useEffect that loads initial data, call GET `/api/agents/pending-purchases` and count the results
- Store count in state
- Pass the count to TabNavigation in pendingCounts object
- Update count whenever PaymentApprovals component refreshes

**Verify:**
```bash
grep -n "pending-purchases\|pendingPackagePurchasesCount" /home/oguda/Desktop/AXX/backend/axx-spaces-frontend/axxspace-admin/src/pages/AdminDashboard.jsx
```
Expected: Should show the API call and state management.

---

### 8. Agent Frontend: Update Notifications Display to Handle New Types
**What to do:**
Find and update the notifications display/listing component in the agent/user frontend to recognize and display 'package_approved' and 'package_rejected' notification types with appropriate messages and styling.

**Files:**
- `/home/oguda/Desktop/AXX/backend/axx-spaces-frontend/src/components/*` (identify the exact notification display component first)
- `/home/oguda/Desktop/AXX/backend/axx-spaces-frontend/src/pages/*` (or wherever notifications are fetched/displayed)

**Changes:**
- Add cases for 'package_approved' and 'package_rejected' in any notification type handler/switch
- For 'package_approved': display success message (green/blue styling) with package tier, amount, and expiry date from notification.message
- For 'package_rejected': display error/warning message (red/orange styling) with rejection reason from notification.message
- Ensure no emojis in messages, professional tone only

**Verify:**
```bash
grep -rn "package_approved\|package_rejected" /home/oguda/Desktop/AXX/backend/axx-spaces-frontend/src/
```
Expected: Should show the new notification types being handled in the notification display logic.

---

### 9. Test Payment Approval Flow End-to-End
**What to do:**
Verify the complete workflow:
1. Agent submits a paid package purchase (POST /api/agents/purchase-package with tier and paymentMessage)
2. Admin sees the pending purchase in the admin dashboard Payment tab
3. Admin approves or rejects the purchase
4. Agent receives notification of approval/rejection
5. On approval, agent's subscription is activated and agent can see the new package details
6. On rejection, agent receives rejection reason

**Files:**
- Test via API calls or through the web interface

**Verify:**
- Agent can submit package purchase and it appears pending
- Admin can view pending purchases in PaymentApprovals tab
- Admin can approve: agent's subscription tier changes, notification sent
- Admin can reject with reason: agent receives rejection notification
- Run backend tests if available: `npm test` (if test suite exists)

---

## Summary of Changes by Module

### Backend (`/home/oguda/Desktop/AXX/backend/axx-spaces-backend`)
1. **Notification.js**: Add package_approved and package_rejected types to enum
2. **agents.js**: Add notifyUser calls to approve-purchase and reject-purchase endpoints
3. **No database migration needed**: Notification schema changes are backward compatible

### Admin Frontend (`/home/oguda/Desktop/AXX/backend/axx-spaces-frontend/axxspace-admin/src`)
1. **New Component: PaymentApprovals.jsx**: Displays and manages pending package purchase approvals
2. **AdminDashboard.jsx**: Import PaymentApprovals, add payment-related state, pass data to tabs
3. **TabNavigation.jsx**: Support payment tab badge with pending count

### Agent Frontend (`/home/oguda/Desktop/AXX/backend/axx-spaces-frontend/src`)
1. **Notification Display**: Update to handle 'package_approved' and 'package_rejected' types

---

## Key Design Decisions

1. **Reuse existing notifyUser utility**: The `notifyUser` function already sends both email and creates a database Notification record. This ensures consistency with the rest of the system.

2. **Store message in Notification**: The 'message' field on Notification stores the rejection reason or approval details, making it searchable and queryable for future reporting.

3. **No new endpoints**: All endpoints already exist (approve-purchase, reject-purchase, pending-purchases). We only enhance them with notifications.

4. **Professional UI**: No emojis, clean table layout, professional colors (green for approve, red for reject) consistent with modern admin dashboards.

5. **Real-time tab badge**: The payment tab shows a count of pending approvals, allowing admin to quickly see if there are items needing attention.

6. **Agent visibility**: Agents receive both email and in-app notifications, ensuring they don't miss approval/rejection updates.

---

## Testing Checklist

- [ ] Notification model updated with new types
- [ ] Approve endpoint sends notification and creates Notification record
- [ ] Reject endpoint sends notification with reason and creates Notification record
- [ ] PaymentApprovals component fetches and displays pending purchases
- [ ] Approve button calls correct endpoint and refreshes list
- [ ] Reject button opens modal, collects reason, calls endpoint, refreshes list
- [ ] Tab badge shows pending count and updates after actions
- [ ] Agent receives email notification on approval/rejection
- [ ] Agent sees notification in dashboard
- [ ] Agent package subscription is activated on approval
- [ ] No outstanding issues with existing payment-related functionality
