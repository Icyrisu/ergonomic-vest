CREATE TABLE IF NOT EXISTS sessions (
    session_name VARCHAR(100) PRIMARY KEY,
    worker_name VARCHAR(100) NOT NULL,
    worker_id VARCHAR(50) NOT NULL,
    group_name VARCHAR(100),
    neutral_pose JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session_data (
    id SERIAL PRIMARY KEY,
    session_name VARCHAR(100) REFERENCES sessions(session_name) ON DELETE CASCADE,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    wrench_status VARCHAR(20) NOT NULL,
    sensors JSONB
);

CREATE INDEX IF NOT EXISTS idx_session_name ON session_data(session_name);

CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL
);

INSERT INTO settings (key, value)
VALUES ('danger_limit', '25')
ON CONFLICT (key) DO NOTHING;
