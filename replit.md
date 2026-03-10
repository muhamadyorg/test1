# Hikvision Event Listener

Real-time HTTP event listener for Hikvision DS-K1T343EFWX Face Recognition Terminal.

## Features
- Receives HTTP POST events from Hikvision devices at `/api/events`
- Parses both XML and JSON event formats
- Real-time WebSocket push to frontend
- Event dashboard with statistics, expandable event cards, raw body viewer
- Built-in test event generator
- Setup guide page

## Architecture
- **Backend**: Express.js + WebSocket (ws)
- **Frontend**: React + TanStack Query + WebSocket client
- **Storage**: In-memory (MemStorage, last 200 events)
- **Port**: 5000

## API Endpoints
- `POST /api/events` — Hikvision sends events here
- `GET /api/events` — Get all stored events
- `DELETE /api/events` — Clear all events
- `POST /api/events/test` — Send a test event

## Hikvision Device Configuration
In device web UI: System and Maintenance → Network → Network Service → HTTP Listening:
- Event Alarm IP/Domain Name: `<your-server-ip>`
- URL: `/api/events`
- Port: `5000`
- Protocol: `HTTP`

## Tech Stack
- React, TypeScript, Vite (frontend)
- Express, tsx (backend)
- ws (WebSocket)
- TanStack Query, wouter, shadcn/ui, Tailwind CSS
