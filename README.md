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

- **Real-Time 3D Visualization**: Renders the user's posture dynamically in a 3D space with zero perceived latency. The 3D bones change color based on safety limits.
- **Dynamic Posture Terminology & Tolerance**: Postures are categorized into **Neutral Pose (Green)**, **Working Pose (Yellow)**, and **Bad Pose (Red)**. Tolerance limits for "Working Pose" can be dynamically configured per session before starting.
- **High-Frequency MQTT Integration**: Dedicated backend service to handle rapid continuous telemetry data from ESP32.
- **WebSocket Streaming**: Instantaneous data broadcasting from the Node.js backend to the React frontend using Socket.io.
- **Continuous Historical Data Tracking**: All sessions and sensor logs are reliably persisted into a PostgreSQL database unconditionally, tracking user posture seamlessly even when the primary tools (Wrench) are temporarily turned OFF.
- **Multi-Sensor Analytical Charts**: Review history via a robust multi-line chart (Recharts) mapping discrete sensors (S1, S4, S5, S6) alongside Tool Wrench usage references. 
- **Containerized Environment**: One-command setup using Docker Compose ensures the app works flawlessly on any machine.

---

## 📡 MQTT Data Architecture & Payload

This dashboard relies on real-time data sent from the Ergonomic Vest (ESP32) over MQTT. The backend subscribes to specific topics, processes the telemetry data, calculates safety parameters, and streams it to the frontend via WebSockets.

### Topics & Payloads
The system listens to the following hardware topics:

1. **Wrench Status Topic**: `UMJ/EV/WR`
   - **Description**: Indicates whether the user is actively using the wrench or heavy tool.
   - **Expected Payload**: `{"value": "ON" | "OFF"}`
   - **Behavior**: While OFF, the vest sensors continue to broadcast and log to the database unconditionally, ensuring continuous posture audit trails. The dashboard visually denotes OFF sections using red overlays.

2. **Sensor Data Topics**: `UMJ/EV/S1` to `UMJ/EV/S6`
   - **Description**: Receives continuous gyroscope/accelerometer telemetry from sensor nodes distributed on the vest.
   - **Expected Payload**: `{"pitch": <float>, "roll": <float>}`
   - **Active Sensor Mapping**: The system focuses strictly on 4 primary axial spine sensors (Arms/Shoulders [S2, S3] are currently disabled).
     - `S1` / `A`: Neck
     - `S4` / `D`: Upper Back / Chest
     - `S5` / `E`: Waist / Mid Back
     - `S6` / `F`: Pelvis
   - **Dynamic Safety Logic**: The Node.js backend processes the `pitch` value against configured `neutral` baselines and `tolerance` ranges (configured at session start) to determine posture safety:
     - 🟢 **Neutral Pose**: Pitch falls within the user-defined safe baseline range (Default e.g., ±10° or -90° depending on physical mount orientation).
     - 🟡 **Working Pose**: Pitch deviates outside Neutral Pose but remains within the user-defined `Tolerance Pose` (e.g., +10° padding).
     - 🔴 **Bad Pose**: Pitch exceeds the Tolerance parameter entirely, presenting an ergonomic danger.

---

## 🛠️ Technology Stack

### 1. Frontend
- **Framework**: React.js
- **Build Tool**: Vite (Lightning fast HMR and optimized builds)
- **Styling**: TailwindCSS (Utility-first modern styling)
- **3D Rendering**: Three.js (WebGL rendering for posture tracking)
- **Charting Engine**: Recharts

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
│   │   ├── hooks/            # Custom React Hooks to encapsulate logic (e.g., useSocket, useSession).
│   │   ├── services/         # API Service functions to communicate with the Backend via HTTP.
│   │   ├── utils/            # Helper functions (including three-setup.ts for procedural 3D logic).
│   │   └── assets/           # Static files like images, icons, and 3D models (.glb).
│   ├── package.json          
│   └── Dockerfile            
│
├── backend/                  # Server & API (Node.js + Express)
│   ├── src/
│   │   ├── config/           # Application and Database configuration files.
│   │   ├── controllers/      # API Request/Response handlers. 
│   │   ├── routes/           # Defines HTTP API endpoints.
│   │   ├── middleware/       # Express middlewares (Validation, Error Handling).
│   │   ├── models/           # Database schemas and direct data access logic.
│   │   ├── services/         # Core business logic. Separated from controllers.
│   │   ├── mqtt/             # MQTT Client setup, topics subscription, and dynamic tolerance logic.
│   │   ├── utils/            # Utility functions like Loggers.
│   │   ├── app.js            # Express application initialization.
│   │   └── server.js         # Main entry point that starts HTTP server and Socket.io.
│   ├── package.json          
│   └── Dockerfile            
│
├── database/                 # Database Configuration
│   ├── init.sql              # SQL script to initialize the PostgreSQL schema automatically on first run.
│   ├── migration/            # Scripts to handle incremental database schema changes over time.
│   └── seed/                 # Scripts containing initial dummy data (seeder) for testing purposes.
│
├── docker-compose.yml        # Docker orchestration file to run all services.
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
