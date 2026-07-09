# Modern Student Question Portal

A modern, fast, and responsive educational web application for random programming question assignments.

## 🚀 Key Features

*   **Student Registration**: Validated entry form collecting Student Name, Roll Number, Branch, Year, Semester, and Email.
*   **Unique 5-Question Assignment**: Generates a set of 5 unique, randomized programming questions from the database. It prevents duplicates and remembers student session questions if they refresh or re-register.
*   **Beautiful Presentation Portal**: Clean card styles, sidebar progress navigation, syntax-highlighted code blocks, and comfortable reading grids.
*   **Interactive Admin Dashboard**:
    *   **PDF Question Parsing**: Upload PDF coding sheets, parse, split questions using custom heuristic patterns, edit/correct them in an interactive uploader preview panel, and bulk-save.
    *   **Manual Question Entry**: Direct entry form for question title, problem statement, and format constraints.
    *   **Question Bank Manager**: Search, preview details, and delete existing bank questions.

---

## 🛠️ Technology Stack

*   **Frontend**: React (TypeScript), Vite, Bootstrap 5, Lucide Icons, Axios.
*   **Backend**: Node.js, Express.js, TypeScript, Multer, PDF-Parse, JWT, Bcrypt.
*   **Database**: PostgreSQL with Prisma ORM.

---

## ⚙️ Prerequisites

*   **Node.js**: v18.0.0 or higher (Tested with v22.17)
*   **npm**: v9.0.0 or higher
*   **PostgreSQL**: A running instance (or a free cloud database like [Neon PostgreSQL](https://neon.tech/))

---

## 🔧 Installation & Setup

### 1. Database Configuration
1.  Sign up or log in to [Neon](https://neon.tech/) and create a new PostgreSQL project.
2.  Copy your database **connection string**. It will look something like this:
    `postgresql://username:password@ep-cool-fog-123456.us-east-2.aws.neon.tech/question_portal?sslmode=require`

### 2. Configure Backend environment
1.  Open the `server` folder.
2.  Edit the `.env` file and replace `DATABASE_URL` with your connection string.
    ```env
    PORT=5000
    DATABASE_URL="YOUR_NEON_POSTGRESQL_CONNECTION_STRING"
    JWT_SECRET="super_secret_admin_key_123456_change_in_production"
    SESSION_DURATION_HOURS=4
    ```

### 3. Initialize Database Tables & Migrations
In your terminal, navigate to the `server` folder and run the Prisma migration command. This creates the PostgreSQL tables and automatically generates the Prisma Client:
```bash
cd server
npx prisma migrate dev --name init
```

### 4. Running the Applications

#### Start Backend API Server
Inside the `server` directory, run:
```bash
npm run dev
```
> [!NOTE]
> The backend server starts on `http://localhost:5000`. On first startup, it will **automatically check and seed** a default Administrator (`username: admin`, `password: adminpassword`) and 5 classic programming questions if the database is empty.

#### Start Frontend Client Dev Server
Open a new terminal window, navigate to the `client` directory, and run:
```bash
cd client
npm run dev
```
> [!NOTE]
> The client dev server starts on `http://localhost:5173`. Open this URL in your web browser.

---

## 🔑 Login Credentials

*   **Admin Username**: `admin`
*   **Admin Password**: `adminpassword`
*   **Student Entry**: Any valid registration details. For testing, choose "Start Questions".

---

## 📁 Directory Architecture
```
c:\Question_format_App\
├── client/                     # React + Vite (Frontend)
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Portal pages (StudentLogin, StudentPortal, AdminLogin, AdminDashboard)
│   │   ├── App.css            # Base design system and custom styling
│   │   └── App.tsx            # Routes and state provider
│   └── package.json
└── server/                     # Express + Node.js (Backend)
    ├── prisma/
    │   └── schema.prisma      # Database definition
    ├── src/
    │   ├── routes/            # API endpoints (auth, students, questions)
    │   ├── utils/             # PDF parser and question splitting engine
    │   └── index.ts           # Server entry point
    └── .env                   # Configuration variables
```
