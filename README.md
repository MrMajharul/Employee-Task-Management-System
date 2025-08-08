# Employee Task Management System

A modern, full-stack Employee Task Management System built with Node.js, Express, MySQL, and vanilla JavaScript. This system provides a comprehensive solution for managing tasks, users, and project workflows.

## Features

### 🔐 Authentication & Authorization
- Secure login system with JWT tokens
- **User Registration** with email validation
- Role-based access control (Admin/Manager/Employee)
- Session management with persistent login

### 📊 Dashboard
- Real-time statistics and metrics
- Role-specific dashboard views
- Visual data representation with modern UI
- **Advanced SQL Views** for optimized data retrieval

### 📋 Task Management
- Create, read, update, and delete tasks
- Assign tasks to employees with **Stored Procedures**
- Track task status (Pending, In Progress, Completed, Cancelled, On Hold)
- Priority levels (Low, Medium, High, Urgent)
- Set due dates and estimated hours
- **Automatic task history tracking** with triggers
- Filter and search tasks with urgency indicators

### 👥 User Management (Admin Only)
- Add, edit, and delete users
- Manage user roles and permissions
- User profile management
- **User performance statistics** with SQL views

### 🔔 Advanced Notification System
- **Automatic notifications** triggered by database events
- Real-time notification system
- Mark notifications as read/unread
- Notification priority levels
- **Daily overdue task reminders** with MySQL Events

### 🗃️ Database Features
- **Triggers** for automatic data logging and notifications
- **Transactions** for data integrity and consistency
- **Stored Procedures** for complex operations
- **Views** for optimized and reusable queries
- **Events** for scheduled tasks (daily reminders)
- **Audit Trail** - Complete task history tracking
- **Data Validation** with constraints and checks

### 📱 Responsive Design
- Mobile-friendly interface
- Modern, clean UI design
- Bootstrap 5 integration

## Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MySQL** with advanced SQL features:
  - Stored Procedures & Functions
  - Triggers for automated actions
  - Transactions for data integrity
  - Views for complex queries
  - Events for scheduled tasks
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **CORS** - Cross-origin resource sharing

### Frontend
- **Vanilla JavaScript** - No framework dependencies
- **Bootstrap 5** - UI framework
- **Font Awesome** - Icons
- **CSS3** - Custom styling

## Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (v14 or higher)
- **MySQL** (v8.0 or higher)
- **npm** or **yarn**

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd Employee-Task-Management-System
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup

#### Create the Database
```sql
CREATE DATABASE task_management_db;
USE task_management_db;
```

#### Create Tables
```sql
-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(50) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'employee') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tasks table
CREATE TABLE tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    assigned_to INT,
    status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- Notifications table
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message TEXT NOT NULL,
    recipient INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (recipient) REFERENCES users(id) ON DELETE CASCADE
);
```

#### Insert Default Admin User
```sql
INSERT INTO users (full_name, username, password, role) 
VALUES ('Admin User', 'admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');
```
*Note: The password hash above corresponds to the password "password"*

### 4. Environment Configuration

Create a `.env` file in the root directory:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=task_management_db
JWT_SECRET=your-secret-key
```

### 5. Start the Application

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

The application will be available at `http://localhost:3000`

## Usage

### Default Login Credentials
- **Username:** admin
- **Password:** password

### Admin Features
- View all tasks and users
- Create, edit, and delete tasks
- Manage user accounts
- View comprehensive dashboard statistics
- Access user management panel

### Employee Features
- View assigned tasks
- Update task status
- View personal dashboard
- Update profile information

## API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout

### Dashboard
- `GET /api/dashboard` - Get dashboard statistics

### Tasks
- `GET /api/tasks` - Get all tasks (filtered by role)
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Users (Admin Only)
- `GET /api/users` - Get all users
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Profile
- `PUT /api/profile` - Update user profile

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark notification as read

## Project Structure

```
├── server.js                 # Main server file
├── package.json              # Dependencies and scripts
├── README.md                 # Project documentation
├── public/                   # Frontend files
│   ├── index.html           # Main HTML file
│   ├── css/
│   │   └── style.css        # Custom styles
│   ├── js/
│   │   └── app.js           # Frontend JavaScript
│   └── img/
│       └── user.png         # User avatar
└── .env                      # Environment variables
```

## Security Features

- **JWT Authentication** - Secure token-based authentication
- **Password Hashing** - bcryptjs for password security
- **SQL Injection Prevention** - Parameterized queries
- **CORS Protection** - Cross-origin request handling
- **Input Validation** - Server-side validation

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

If you encounter any issues or have questions, please:

1. Check the existing issues
2. Create a new issue with detailed information
3. Include error messages and steps to reproduce

## Acknowledgments

- Bootstrap for the UI framework
- Font Awesome for the icons
- MySQL for the database system
- Express.js for the web framework