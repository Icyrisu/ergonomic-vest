# Ergonomic Vest Dashboard

Real-time monitoring dashboard for the Ergonomic Vest project. Uses MQTT to receive ESP32 gyroscope data, processes posture via a 3D model, and stores sessions using PostgreSQL.

## Prerequisites
- Docker and Docker Compose installed

## Setup Instructions

1. **Environment Variables**:
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to set your desired passwords if necessary. By default, it will use `admin` and `your_password_here`.

2. **Run with Docker Compose**:
   Ensure Docker is running, then execute:
   ```bash
   docker-compose up -d --build
   ```

3. **Access the Application**:
   - Open your browser and go to `http://localhost:8080` (or `http://<your-ip>:8080` from your mobile phone).
   - The backend runs on `http://localhost:3000`.

## Features
- **Real-Time 3D Posture Visualization**: Uses React Three Fiber.
- **Cross-Device Sync**: Any Danger Limit changes sync immediately via WebSockets.
- **Offline Data Storage**: Session and posture logs are persisted in PostgreSQL.

## Stopping the Server
To stop the application, run:
```bash
docker-compose down
```

## MQTT Topics & Payload Structure

The dashboard subscribes and publishes to a specific MQTT broker (`wss://broker.hivemq.com:8884/mqtt` by default) to communicate with the ESP32 hardware.

### 1. Sensor Data (From ESP32 to Dashboard)
The ESP32 should publish data to the following topics continuously:
- `UMJ/EV/S1`: Left Arm / L-Shoulder
- `UMJ/EV/S2`: Right Arm / R-Shoulder
- `UMJ/EV/S3`: Chest / Spine3
- `UMJ/EV/S4`: Mid Back / Spine2
- `UMJ/EV/S5`: Low Back / Spine1
- `UMJ/EV/S6`: Pelvis

**Payload Format (JSON):**
```json
{
  "pitch": -45.5,
  "roll": 2.3
}
```
*(Notes: Pitch `0` is bent forward, `-90` is standing upright. Roll defines side-to-side leaning).*

### 2. Impact Wrench Status (Bidirectional)
To know when the worker is actively drilling/wrenching, the vest listens to this topic:
- `UMJ/EV/WR`

**Payload Format (JSON):**
```json
{
  "value": "ON" 
}
```
*(Value can be `"ON"` or `"OFF"`).*
