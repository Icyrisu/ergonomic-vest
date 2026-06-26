# Ergonomic Vest Dashboard

A full-stack monitoring dashboard for an Ergonomic Vest, featuring real-time 3D posture visualization, MQTT sensor integration, and data history tracking.

## Architecture

The project has been refactored using Clean Architecture principles to ensure scalability, maintainability, and security.

### Structure

```
project/
├── frontend/ (React + Vite, TailwindCSS, Three.js)
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── hooks/       # Custom React hooks (useSocket, useSessions)
│   │   ├── services/    # API calls
│   │   └── assets/      # Static assets
│   └── Dockerfile
│
├── backend/ (Node.js + Express, Socket.io)
│   ├── src/
│   │   ├── config/      # Environment and Database configuration
│   │   ├── controllers/ # HTTP Request handlers
│   │   ├── middleware/  # Error handling and validation
│   │   ├── models/      # Database queries
│   │   ├── mqtt/        # MQTT Client Service
│   │   ├── routes/      # API routing
│   │   ├── services/    # Business logic
│   │   └── utils/       # Logger and helpers
│   └── Dockerfile
│
├── database/ (PostgreSQL)
│   └── init.sql         # Database schema initialization
│
├── docker-compose.yml   # Multi-container orchestration
└── .env                 # Environment variables
```

## Prerequisites

- Docker
- Docker Compose

## Installation & Configuration

1. Clone the repository.
2. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
3. Update the `.env` file with your specific configurations (e.g., PostgreSQL credentials, MQTT broker URL, ports).

## Running the Application

The entire application can be started using Docker Compose:

```bash
docker-compose up -d --build
```

This command will start:
- **PostgreSQL Database** on port `5432` (or your configured `DATABASE_PORT`).
- **Backend API & Socket Server** on port `3000` (or your configured `BACKEND_PORT`).
- **Frontend Vite Server** on port `8080` (or your configured `FRONTEND_PORT`).

Wait for the containers to become healthy. You can then access the dashboard at:
`http://localhost:8080` (assuming default port).

## Troubleshooting

- **Database not connecting:** Ensure the credentials in `.env` are correct and that the database container is fully initialized. The backend is configured to wait for the database healthcheck before starting.
- **MQTT offline:** Check if your `MQTT_BROKER` URL in `.env` is reachable. The backend will log connection errors.
- **Frontend cannot reach backend:** Ensure `VITE_BACKEND_URL` points to the correct backend host and port. When using Docker Compose locally, this should usually be `http://localhost:3000` (as mapped to your host machine).
- **View Logs:** You can inspect logs for specific services using:
  ```bash
  docker-compose logs -f backend
  ```
