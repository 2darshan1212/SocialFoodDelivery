# Social Food Delivery System 🍔🚀

A MERN stack project combining **Social Media features** and **Food Delivery** services from **local kitchens**.

## Project Structure
- `/frontend` - React frontend application with its own dependencies
- `/backend` - Node.js Express backend API with its own dependencies
- `/docker` - Docker configuration files

## Setup and Running Instructions

### Prerequisites
- Node.js (recommended version 16.x or higher)
- npm (recommended version 8.x or higher)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/social-food-delivery-system.git
cd social-food-delivery-system
```

2. Install Backend Dependencies:
```bash
cd backend
npm install
```

3. Install Frontend Dependencies:
```bash
npm install
```

4. Quick Installation (from frontend folder):
```bash
npm run install-all
```

### Running the Application

#### Option 1: Using PowerShell (Windows) - Separate Terminals

Since PowerShell doesn't support the '&&' operator for command chaining, run the frontend and backend in separate terminal windows:

Terminal 1 (Backend):
```powershell
cd ../backend
npm run dev
```

Terminal 2 (Frontend):
```powershell
npm run dev
```

#### Option 2: Using PowerShell with Windows-specific Script

```powershell
npm run windows-start
```
This will automatically open both frontend and backend in separate terminal windows.

#### Option 3: Using Bash/Shell (Linux/Mac) with Concurrently

```bash
npm run start
```

This will launch both the frontend and backend concurrently.

### Environment Variables
Make sure to configure your environment variables properly:

Backend (create a .env file in the backend directory):
```
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

Frontend (create a .env file in the frontend directory):
```
VITE_API_URL=http://localhost:5000
```

## Features

- User authentication and profile management
- Social media features (posts, comments, likes)
- Restaurant listings and menus
- Food ordering system
- Real-time order tracking
- Payment integration
- Bookmark/favorites functionality
- Admin dashboard

---

## 📁 Project Structure (Updated)

```
social-food-delivery-system/
├── backend/           # Backend with its own dependencies
│   ├── node_modules/  # Backend dependencies
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   └── package.json   # Backend package.json
├── frontend/          # Frontend with its own dependencies
│   ├── node_modules/  # Frontend dependencies 
│   ├── src/
│   ├── public/
│   ├── package.json   # Frontend package.json with concurrently
│   ├── README.md      # This file
│   ├── start.ps1      # PowerShell startup helper script
│   └── start.sh       # Bash startup helper script
└── docker/            # Docker configuration
```

---

## 🚀 Available Scripts

### Frontend Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start frontend development server |
| `npm run build` | Build frontend for production |
| `npm run start` | Run both frontend and backend using concurrently (Linux/Mac) |
| `npm run windows-start` | Run both frontend and backend in separate windows (Windows) |
| `npm run install-all` | Install dependencies for both frontend and backend |

### Backend Scripts (`../backend`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start backend with nodemon |
| `npm start` | Start backend for production |

---

## 🐳 Docker Setup (Optional)

Inside `../docker/` we maintain:

- `docker-compose.yml`
- `backend.Dockerfile`
- `frontend.Dockerfile`

To run:

```bash
docker-compose up --build
```

---

## 📧 Contact

- Developer: **Krishna Patidar**
- Email: krishnapatidar4583@gmail.com

---

# 🔥 Happy Coding!
