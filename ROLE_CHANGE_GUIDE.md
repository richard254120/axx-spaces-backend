# Admin Role Change Guide

## Overview
This guide explains how to grant admin access to any user by simply changing their role in the MongoDB database. Users can be converted from any role (landlord, seller, mover, business owner, etc.) to admin, and they will immediately be able to login to the admin panel with their existing credentials.

## System Configuration

**✅ Database Constraints Removed**: Compound unique indexes on `email+role` and `phone+role` have been removed to allow seamless role changes.

**✅ Authentication Logic Updated**: Admin users bypass email verification and approval requirements, allowing immediate access upon role change.

**✅ Server Configuration**: Backend server no longer recreates the blocking indexes on startup.

## How to Change User Roles

### Method 1: Using MongoDB Compass (GUI)

1. **Open MongoDB Compass** and connect to your database
2. **Navigate to the `users` collection** in the `axx-spaces` database
3. **Find the user** you want to make admin by email or phone
4. **Edit the document** and change the `role` field to `"admin"`
5. **Save the changes**

Example change:
```json
{
  "role": "landlord"  // Change this to "admin"
}
```

Becomes:
```json
{
  "role": "admin"
}
```

### Method 2: Using MongoDB Shell (CLI)

```bash
# Connect to MongoDB
mongosh axx-spaces

# Change user role to admin
db.users.updateOne(
  { email: "user@example.com" },
  { $set: { role: "admin" } }
)

# Verify the change
db.users.findOne({ email: "user@example.com" }, { role: 1, name: 1, email: 1 })
```

### Method 3: Using Debug Script

```bash
node /home/oguda/Desktop/AXX/backend/axx-spaces-backend/debugAdminLogin.js user@example.com
```

This script will show the current user status and if they have admin role.

## Key Features

### ✅ No Password Changes Required
Users keep their existing password when their role is changed to admin.

### ✅ Bypasses Email Verification
Admin users can login even if their email is not verified (`isEmailVerified: false`).

### ✅ Bypasses Account Approval
Admin users can login even if their account is not approved (`isApproved: false`).

### ✅ Immediate Access
Role changes take effect immediately - no server restart required.

### ✅ Works from Any Role
Users can be converted from any role:
- landlord → admin
- seller → admin  
- mover → admin
- business → admin
- team → admin

## Testing Role Changes

### Test Script
```bash
node /home/oguda/Desktop/AXX/backend/axx-spaces-backend/testRoleChange.js
```

This script demonstrates:
1. Creating a user with landlord role
2. Verifying landlord cannot login as admin
3. Changing role to admin in database
4. Verifying admin login works with same credentials
5. Cleaning up test data

### Manual Testing
```bash
# 1. Find a user in database
node /home/oguda/Desktop/AXX/backend/axx-spaces-backend/checkUser.js user@example.com

# 2. Change role to admin using MongoDB Compass or shell

# 3. Test login via API
curl -X POST http://localhost:1000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"their_password","role":"admin"}'

# 4. Login to admin panel at http://localhost:3000
```

## Common Scenarios

### Scenario 1: Promote a Landlord to Admin
```javascript
// In MongoDB shell
db.users.updateOne(
  { email: "landlord@example.com", role: "landlord" },
  { $set: { role: "admin" } }
)
```

### Scenario 2: Promote a Business Owner to Admin
```javascript
// In MongoDB shell
db.users.updateOne(
  { email: "business@example.com", role: "business" },
  { $set: { role: "admin" } }
)
```

### Scenario 3: Promote a Mover to Admin
```javascript
// In MongoDB shell
db.users.updateOne(
  { email: "mover@example.com", role: "mover" },
  { $set: { role: "admin" } }
)
```

## Admin Panel Access

Once a user's role is changed to admin:

1. **Admin Panel URL**: http://localhost:3000
2. **Login**: Use their existing email and password
3. **Access**: Full admin dashboard with all features

## Troubleshooting

### Issue: User still cannot login after role change

**Solution**: Check the role was actually changed:
```bash
node /home/oguda/Desktop/AXX/backend/axx-spaces-backend/checkUser.js user@example.com
```

### Issue: Database constraint error when changing role

**Solution**: Run the constraint removal script:
```bash
node /home/oguda/Desktop/AXX/backend/axx-spaces-backend/removeRoleConstraints.js
```

### Issue: Indexes keep getting recreated

**Solution**: Ensure server.js has been updated to skip compound index creation (already done in this setup).

## Security Considerations

### ⚠️ Important Notes

1. **Password Security**: Admin users should have strong passwords. Consider requiring password changes when promoting to admin.

2. **Audit Trail**: Consider implementing audit logging to track role changes.

3. **Multi-Factor Authentication**: Consider implementing 2FA for admin accounts.

4. **Session Management**: Admin sessions should have appropriate timeout policies.

5. **Access Review**: Regularly review admin access and remove admin roles when no longer needed.

## Useful Scripts

### List All Admin Users
```bash
node /home/oguda/Desktop/AXX/backend/axx-spaces-backend/listAdmins.js
```

### Check Specific User
```bash
node /home/oguda/Desktop/AXX/backend/axx-spaces-backend/checkUser.js user@example.com
```

### Debug Login Issues
```bash
node /home/oguda/Desktop/AXX/backend/axx-spaces-backend/debugAdminLogin.js user@example.com password
```

### Remove Database Constraints
```bash
node /home/oguda/Desktop/AXX/backend/axx-spaces-backend/removeRoleConstraints.js
```

## Summary

The system now supports seamless role changes:
- ✅ Change any user's role to "admin" in database
- ✅ User can immediately login to admin panel
- ✅ No password changes required
- ✅ Bypasses verification and approval requirements
- ✅ Works from any existing role
- ✅ No database constraints blocking role changes

This provides a simple and efficient way to manage admin access by directly modifying user roles in the database.