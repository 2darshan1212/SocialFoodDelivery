# Admin Dashboard Setup Guide

This guide will help you set up and troubleshoot the admin dashboard functionality.

## Issues Fixed

1. **Mobile Sidebar Admin Access**: Fixed incorrect role check (`user.role === "admin"` → `user.isAdmin`)
2. **Admin Route Redirect**: Added automatic redirect from `/admin` to `/admin/dashboard`
3. **Mobile Navigation**: Added missing `handleMobileNavChange` function in AdminLayout
4. **Admin Verification**: Made admin verification less strict and more user-friendly

## Setting Up Admin Users

### Method 1: Using the makeAdmin Script

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a `.env` file with your MongoDB connection:
   ```env
   MONGO_URI=mongodb://localhost:27017/socialfooddelivery
   JWT_SECRET=your-secret-key
   PORT=8000
   ```

3. Run the makeAdmin script:
   ```bash
   node scripts/makeAdmin.js user@example.com
   ```

### Method 2: Direct Database Update

If you have access to your MongoDB database, you can directly update a user:

```javascript
// In MongoDB shell or MongoDB Compass
db.users.updateOne(
  { email: "user@example.com" },
  { $set: { isAdmin: true } }
)
```

### Method 3: Using the Admin Check Page

1. Login as any user
2. Navigate to `/admin-check` 
3. Use the "Fix Admin Status" button if you have admin privileges

## Accessing the Admin Dashboard

1. **Login** with an admin user account
2. **Navigate** to `/admin/dashboard` or click the Admin option in the sidebar
3. **Mobile users** can access admin via the mobile sidebar menu

## Admin Dashboard Features

- **Dashboard**: Overview with order statistics and charts
- **Orders Management**: View and manage all orders
- **Categories Management**: Manage food categories
- **Users Management**: Manage user accounts and admin privileges
- **Delivery Agents**: Manage delivery personnel
- **Admin Check**: Diagnostic tool for troubleshooting

## Troubleshooting

### Admin Dashboard Not Opening

1. **Check User Status**: Ensure the user has `isAdmin: true` in the database
2. **Clear Browser Cache**: Clear cookies and local storage
3. **Check Console**: Look for JavaScript errors in browser console
4. **Verify Backend**: Ensure backend is running and accessible

### Admin Endpoints Not Working

1. **Check Environment Variables**: Ensure `MONGO_URI` is set correctly
2. **Database Connection**: Verify MongoDB is running and accessible
3. **Authentication**: Ensure user is properly logged in with valid tokens

### Mobile Sidebar Not Showing Admin Option

- This was fixed by changing the role check from `user.role === "admin"` to `user.isAdmin`
- Clear browser cache and reload the page

## API Endpoints

The admin functionality uses these key endpoints:

- `GET /api/v1/user/me` - Get current user info
- `GET /api/v1/user/check-admin` - Verify admin status
- `GET /api/v1/orders/admin/stats` - Get order statistics
- `GET /api/v1/orders/admin/all` - Get all orders
- `GET /api/v1/user/admin/users` - Get all users

## Security Notes

- Admin privileges should be granted carefully
- Always use HTTPS in production
- Regularly audit admin user accounts
- Monitor admin actions through logging

## Development vs Production

### Development
- Admin check page available at `/admin-check`
- More verbose logging and error messages
- Less strict admin verification

### Production
- Remove or secure the admin check page
- Enable proper error logging
- Use environment-specific configurations 