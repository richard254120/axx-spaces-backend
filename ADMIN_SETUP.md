# Admin User Management

## Overview
The AXXSPACE admin system supports multiple admin users. Any user with the `role: "admin"` in the database can login to the admin website.

## Adding New Admin Users

### Method 1: Using the addAdmin.js Script (Recommended)

Run the script from the backend directory:

```bash
node addAdmin.js <email> <password> [name] [phone]
```

**Example:**
```bash
node addAdmin.js john@example.com password123 "John Doe" "0712345678"
```

**Parameters:**
- `email` (required): Admin user's email address
- `password` (required): Admin user's password (must be at least 6 characters with letters and numbers)
- `name` (optional): Admin user's full name (defaults to "Admin User")
- `phone` (optional): Admin user's phone number (defaults to "0000000000")

### Method 2: Using the createAdmin.js Script

The original createAdmin.js script can be used to reset/update the main admin account:

```bash
node createAdmin.js
```

This will create/update the default admin account:
- Email: admin@axxspace.com
- Password: axxspaceadmin1

## Admin Login

Once an admin user is created, they can login to the admin website at:
- URL: http://localhost:5174 (or your admin panel URL)
- Use their email and password

## Current Admin Users

### Default Admin
- Email: admin@axxspace.com
- Password: axxspaceadmin1
- Name: AxxSpace Admin

### Test Admin (Created for Testing)
- Email: testadmin@axxspace.com
- Password: testadmin123
- Name: Test Admin
- Phone: 0712345678

## Admin Login Process

The admin login system:
1. Accepts email, password, and role="admin"
2. Verifies the user exists in the database with role="admin"
3. Validates the password
4. Returns a JWT token for authentication
5. Admin users bypass email verification requirements

## Database Structure

Admin users are stored in the `users` collection with:
- `role: "admin"`
- `isEmailVerified: true`
- `isApproved: true`
- Standard user fields (name, email, password, phone, etc.)

## Security Notes

- Admin passwords are hashed using bcrypt
- JWT tokens expire after 7 days
- Admin users bypass email verification requirements
- Consider implementing additional security measures like:
  - Two-factor authentication
  - IP whitelisting
  - Session timeout
  - Audit logging for admin actions

## Troubleshooting

### Login Issues
If an admin user cannot login:
1. Verify the user exists in the database with `role: "admin"`
2. Check the password is correct
3. Ensure the backend server is running on port 1000
4. Check browser console for API errors

### Reset Admin Password
To reset an admin password, run the addAdmin.js script again with the same email and new password:

```bash
node addAdmin.js admin@axxspace.com newpassword123
```

### View All Admin Users
To view all admin users in the database, you can use MongoDB Compass or run:

```bash
mongosh axx-spaces --eval "db.users.find({role: 'admin'}, {name: 1, email: 1, phone: 1, role: 1})"
```