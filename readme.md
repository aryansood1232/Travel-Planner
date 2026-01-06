# Travel Planner – Docker Setup

This project is a **Dockerized Travel Planner web application** built with **Node.js**, **Express**, and **MySQL 8**. The entire app (backend + database) runs using **Docker Compose**, making setup simple and consistent across machines.

This README focuses **only on the Docker workflow**.

---

## 🐳 Tech Stack

- **Backend:** Node.js, Express
- **Database:** MySQL 8
- **Containerization:** Docker & Docker Compose
- **Database Driver:** mysql2

---

## 📦 Prerequisites

Make sure you have the following installed:

- Docker
- Docker Compose

Verify:

```bash
docker --version
docker-compose --version
```

---

## 🔐 Environment Variables

This project uses environment variables for database credentials, API keys, and secrets.

### `.env.example`

```env
# Database configuration
DB_HOST=db
DB_USER=root
DB_PASSWORD=your_mysql_password   # Must match MYSQL_ROOT_PASSWORD in docker-compose.yml
DB_NAME=travel_planner

# API Keys (replace with your own)
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Session / Auth
SESSION_SECRET=your_session_secret
```

### Database Initialization (`init.sql`)

* The `init.sql` file is automatically executed by MySQL **the first time the container starts**.
* It creates the `travel_planner` database and any required tables.

### Re-running `init.sql`

If the database is missing or you want a clean reset:

```bash
docker-compose down -v
docker-compose up --build
```

⚠️ This deletes all database data and recreates it from `init.sql`.



---

## 🚀 Running the App with Docker

### 1️⃣ Build and start containers

```bash
docker-compose up --build
```

This will:
- Build the Node.js app image
- Start MySQL 8
- Run `init.sql` (if database does not exist)
- Start the backend server

---

### 2️⃣ Access the app

Once running, the server will be available at:

http://localhost:3028/signup.html

---

### 3️⃣ Stop containers

```bash
docker-compose down
```

---

### 4️⃣ Full reset (database + containers)

```bash
docker-compose down -v
docker volume prune -f
```

---

## 🛠 Access MySQL Container (Optional)

To log into MySQL inside Docker:

```bash
docker exec -it db mysql -u root -p
```

Password is the one set in `.env`.

---

## ❗ Common Issues

### MySQL access denied

Make sure:
- `DB_HOST=db` (Docker service name)
- Password in `.env` matches MySQL container password
- Containers were recreated if password changed

---



## 👤 Author

Aryan Sood

Computer Science | Full-Stack Developer



## Clone the Repository

```bash
git clone https://github.com/aryansood1232/travel-planner.git
cd travel-planner
```

