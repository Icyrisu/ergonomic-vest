# Ergonomic Vest Dashboard 🦺💻

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![MQTT](https://img.shields.io/badge/mqtt-660066?style=for-the-badge&logo=mqtt&logoColor=white)

A full-stack, real-time monitoring dashboard engineered to receive, process, and visualize posture data from a smart Ergonomic Vest. This system captures data from hardware sensors (ESP32 and Gyroscope/Accelerometer) via the MQTT protocol and renders it seamlessly into a real-time 3D posture visualization using Three.js.

The project has been heavily refactored utilizing **Clean Architecture** principles to guarantee a professional, well-organized, scalable, and production-ready structure.

---

## 🌟 Key Features

- **Real-Time 3D Visualization**: Renders the user's posture dynamically in a 3D space with zero perceived latency.
- **High-Frequency MQTT Integration**: Dedicated backend service to handle rapid continuous telemetry data from ESP32.
- **WebSocket Streaming**: Instantaneous data broadcasting from the Node.js backend to the React frontend using Socket.io.
- **Historical Data Tracking**: All sessions and sensor logs are reliably persisted into a PostgreSQL database.
- **Containerized Environment**: One-command setup using Docker Compose ensures the app works flawlessly on any machine.

---

## 📡 MQTT Data Architecture & Payload

This dashboard relies on real-time data sent from the Ergonomic Vest (ESP32) over MQTT. The backend subscribes to specific topics, processes the telemetry data, calculates safety parameters, and streams it to the frontend via WebSockets.

### Topics & Payloads
The system listens to the following hardware topics:

1. **Wrench Status Topic**: `UMJ/EV/WR`
   - **Description**: Indicates whether the user is actively using the wrench or heavy tool.
   - **Expected Payload**: `{"value": "ON" | "OFF"}`

2. **Sensor Data Topics**: `UMJ/EV/S1` to `UMJ/EV/S6`
   - **Description**: Receives continuous gyroscope/accelerometer telemetry from 6 different sensor nodes distributed on the vest.
   - **Expected Payload**: `{"pitch": <float>, "roll": <float>}`
   - **Dynamic Safety Logic**: The Node.js backend processes the `pitch` value to determine posture safety in real-time before broadcasting it:
     - 🟢 **Safe**: Pitch ≤ -60
     - 🟡 **Warning**: -60 < Pitch ≤ -45
     - 🔴 **Danger**: Pitch > -45

---

## 🛠️ Technology Stack

### 1. Frontend
- **Framework**: React.js
- **Build Tool**: Vite (Lightning fast HMR and optimized builds)
- **Styling**: TailwindCSS (Utility-first modern styling)
- **3D Rendering**: Three.js (WebGL rendering for posture tracking)

### 2. Backend
- **Runtime**: Node.js (v20 Alpine recommended)
- **Framework**: Express.js
- **Real-Time Engine**: Socket.io
- **IoT Protocol**: MQTT.js

### 3. Database & Infrastructure
- **Relational Database**: PostgreSQL (Robust data storage)
- **Orchestration**: Docker & Docker Compose

---

## 📂 Project Structure & Clean Architecture

The codebase is strictly separated into distinct layers to maintain high cohesion and low coupling.

```text
project_root/
│
├── frontend/                 # User Interface Application (React + Vite)
│   ├── src/
│   │   ├── components/       # Reusable UI components (e.g., buttons, cards, 3D Canvas wrappers).
│   │   ├── pages/            # Page-level components representing different views (e.g., Dashboard, History).
│   │   ├── hooks/            # Custom React Hooks to encapsulate logic (e.g., useSocket, useSensorData).
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

## ⚙️ Environment Variables

The system relies on a `.env` file to handle secrets and configurations safely. Do not hardcode these values.

1. **Create the file**: Copy the example template into a new `.env` file in the root directory.
   ```bash
   cp .env.example .env
   ```

2. **Configure your `.env`**:
   ```env
   # --- Database Configurations ---
   POSTGRES_USER=admin                 # Username for PostgreSQL
   POSTGRES_PASSWORD=your_password     # Password for PostgreSQL
   POSTGRES_DB=ergonomic_vest          # Database Name
   DATABASE_PORT=5432                  # Database exposed port

   # --- Backend Configurations ---
   BACKEND_PORT=3000                   # API and Socket Server Port
   MQTT_BROKER=wss://broker.hivemq.com:8884/mqtt  # Your MQTT Broker Address (e.g., HiveMQ, Mosquitto)

   # --- Frontend Configurations ---
   FRONTEND_PORT=8080                  # Port to access the Dashboard
   ```

---

## 🚀 Installation & Running (Docker Compose)

The easiest and recommended way to run this project is through Docker Compose. This ensures all services, networking, and dependencies are resolved automatically.

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) installed.
- [Docker Compose](https://docs.docker.com/compose/install/) installed.

### Steps to Run
1. Open a terminal in the root directory.
2. Build and start the containers in detached mode:
   ```bash
   docker compose up -d --build
   ```
3. Wait approximately 30-60 seconds for the database to initialize and the servers to start.
4. **Access the application**:
   - **Frontend (Dashboard)**: [http://localhost:8080](http://localhost:8080) (or your configured `FRONTEND_PORT`)
   - **Backend API**: `http://localhost:3000`
   - **PostgreSQL Database**: Port `5432`

> **Note on Healthchecks**: The Node.js backend is configured in `docker-compose.yml` to wait (`depends_on`) for the `service_healthy` state of PostgreSQL. The API won't start until the database is fully ready to accept connections.

---

## 🛠️ Local Development (Without Docker)

If you wish to develop without Docker, you must start each service manually.

**1. PostgreSQL**
Ensure you have a PostgreSQL server running locally with the credentials matching your `.env` file. Manually execute the `database/init.sql` script.

**2. Backend**
```bash
cd backend
npm install
npm run dev
```

**3. Frontend**
Ensure you have created a `.env` file inside the `frontend` folder containing `VITE_BACKEND_URL=http://localhost:3000`.
```bash
cd frontend
npm install
npm run dev
```

---

## 🔧 Troubleshooting & Common Issues

- **Backend Database Connection Error**: 
  - Ensure the credentials in `.env` are correct. 
  - *Important*: The `init.sql` script inside the Docker PostgreSQL container **only runs if the data volume is completely empty**. If you changed the schema/password in `.env` but the container has run previously, you need to delete the Docker volume first using `docker compose down -v`.
  
- **Frontend Cannot Connect to Backend (Socket/API)**: 
  - Verify that the frontend can reach the backend. If testing on a mobile device, `localhost` won't work; you must set `VITE_BACKEND_URL` to your computer's local IP address (e.g., `http://192.168.1.5:3000`).

- **No Incoming MQTT Data on Dashboard**: 
  - Verify that your hardware (ESP32) is publishing to the exact same `MQTT_BROKER` URL specified in `.env`.
  - Check the backend logs for connection errors:
    ```bash
    docker compose logs -f backend
    ```

- **Total Reset / Clean Rebuild**: 
  If the application state becomes corrupted, completely wipe all containers, networks, and volumes (this will erase your local DB data):
  ```bash
  docker compose down -v
  docker compose up -d --build
  ```
