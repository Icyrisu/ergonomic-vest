# Ergonomic Vest Dashboard

A full-stack, real-time monitoring dashboard designed to receive, process, and visualize real-time posture data from a smart Ergonomic Vest equipped with ESP32 and Gyroscope sensors via the MQTT protocol.

This project is built using **Clean Architecture** principles to ensure a professional, well-organized, scalable, and production-ready structure. It is designed to be easily run locally using Docker Compose.

---

## 🛠️ Technology Stack

- **Frontend**: React, Vite, TailwindCSS, Three.js
- **Backend**: Node.js, Express.js, Socket.io, MQTT.js
- **Database**: PostgreSQL
- **Infrastructure**: Docker, Docker Compose

---

## 📂 Project Structure & Explanation (Clean Architecture)

The project separates concerns into three main services: Frontend, Backend, and Database.

```text
project_root/
│
├── frontend/                 # User Interface Application (React + Vite)
│   ├── src/
│   │   ├── components/       # Reusable UI components (e.g., buttons, cards, 3D Canvas wrappers).
│   │   ├── pages/            # Page-level components representing different views (e.g., Dashboard, History).
│   │   ├── hooks/            # Custom React Hooks to encapsulate logic (e.g., WebSocket subscription logic).
│   │   ├── services/         # API Service functions to communicate with the Backend via HTTP.
│   │   ├── utils/            # Helper functions and utilities for formatting data or general logic.
│   │   └── assets/           # Static files like images, icons, and 3D models (.gltf / .obj).
│   ├── package.json          # Frontend dependencies and scripts.
│   └── Dockerfile            # Instructions to containerize the frontend (using Nginx/Node).
│
├── backend/                  # Server & API (Node.js + Express)
│   ├── src/
│   │   ├── config/           # Application and Database configuration files (loading from .env).
│   │   ├── controllers/      # API Request/Response handlers. Extracts data from requests and passes to services.
│   │   ├── routes/           # Defines HTTP API endpoints and maps them to controllers.
│   │   ├── middleware/       # Express middlewares for Request Validation, Error Handling, and Authentication.
│   │   ├── models/           # Database schemas and direct data access logic for PostgreSQL.
│   │   ├── services/         # Core business logic. Separated from controllers for reusability.
│   │   ├── mqtt/             # MQTT Client setup, topics subscription, and data handling from ESP32.
│   │   ├── utils/            # Utility functions like Loggers or data transformers.
│   │   ├── app.js            # Express application initialization and middleware bindings.
│   │   └── server.js         # Main entry point that starts the HTTP server and Socket.io.
│   ├── package.json          # Backend dependencies and scripts.
│   └── Dockerfile            # Instructions to containerize the Node.js backend.
│
├── database/                 # Database Configuration
│   ├── init.sql              # SQL script to initialize the PostgreSQL schema automatically on first run.
│   ├── migration/            # Scripts to handle incremental database schema changes over time.
│   └── seed/                 # Scripts containing initial dummy data (seeder) for testing purposes.
│
├── docker-compose.yml        # Docker orchestration file to run all services (frontend, backend, database) together.
├── .env                      # Local Environment Variables file (not committed to Git).
└── .env.example              # Template showing the required environment variables structure.
```

---

## ⚙️ Environment Configuration

This application uses Environment Variables to prevent hardcoding sensitive credentials and ensure security.

1. Copy `.env.example` to `.env` in the root directory.
   ```bash
   cp .env.example .env
   ```
2. Update the configurations in the newly created `.env` file (e.g., PostgreSQL credentials, MQTT Broker URL, Ports). 
   - *Note*: Ensure that frontend variables (like `VITE_BACKEND_URL`) point correctly to the backend server URL.

---

## 🚀 Installation & Running (Docker Compose)

Make sure you have **Docker** and **Docker Compose** installed on your system. This project is designed to run instantly with a single command.

1. Open a terminal in the root directory (where `docker-compose.yml` is located).
2. Run the following command:

   ```bash
   docker compose up --build
   ```
3. Wait for the build process (pulling alpine images, caching, etc.) and container initialization to finish.
4. Access the application:
   - **Frontend (Dashboard)**: `http://localhost:8080` (or the port defined by `VITE_FRONTEND_PORT`)
   - **Backend API**: `http://localhost:3000` (or the port defined by `BACKEND_PORT`)
   - **PostgreSQL Database**: Running locally on port `5432`

*Note: The Backend is configured to wait (`depends_on`) for the `service_healthy` state of PostgreSQL before attempting a connection.*

---

## 🔧 Troubleshooting

- **Backend Database Connection Error**: Ensure the credentials in `.env` are correct. The `init.sql` script inside the Docker PostgreSQL container only runs if the data volume is completely empty. If you changed the schema/password in `.env` but the container has run previously, you need to delete the Docker volume first.
- **Frontend Cannot Connect to Backend (Socket/API)**: Verify that the `VITE_BACKEND_URL` variable in your `.env` configuration points to a URL accessible by the browser (e.g., `http://localhost:3000`).
- **No Incoming MQTT Data**: Verify your MQTT Broker connection and URL. You can check for connection errors caught by the error handler via the backend container logs.
- **Viewing Application Logs**: Use the following command to view specific service logs:
  ```bash
  docker compose logs -f backend
  ```
- **Total Reset / Clean Rebuild**: If you need to clear all volumes and rebuild completely from scratch, run:
  ```bash
  docker compose down -v
  docker compose up -d --build
  ```
