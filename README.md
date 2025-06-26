# Cornhole Arena

This is a simple web application to track cornhole games. It exposes a small API powered by Node.js and Express and stores game data in SQL Server.
Each player belongs to one of our company locations. The app does not require a location when starting a game because it is part of the player profile.

The API now also lets you create and list players and locations. When starting a
game you pick from the players stored in the database. Games automatically end
when a team reaches **21 points**. The winning team is stored in the `Games`
table and each player's win/loss record and Elo rating are updated. Every player
starts with an Elo score of **1000** which adjusts after each completed match.

## Prerequisites

- Node.js 18+
- Access to a SQL Server instance

## Setup

1. Install dependencies (requires internet access):

   ```bash
   npm install
   ```

2. Configure the following environment variables:

   - `DB_USER` – database username
   - `DB_PASS` – database password
   - `DB_SERVER` – hostname of the SQL Server instance
   - `DB_NAME` – database name containing the `Games` and `GameEvents` tables
   - `PORT` (optional) – port for the HTTP server (defaults to `3000`)

3. Start the server:

   ```bash
   npm start
   ```

4. Open `http://localhost:3000` in your browser to create a game and record turns.

## Project Structure

```
.
├── server.js       - Express server with API endpoints
├── package.json    - Node.js dependencies and scripts
└── public/
    └── index.html  - Minimal front-end to create games and add turns
```

## API Overview

```
POST /locations  - add a location
GET  /locations  - list locations
POST /players    - add a player (requires email and a location ID)
GET  /players    - list players (includes current Elo rating)
POST /games      - start a game with existing players
```

Games end automatically when a team scores 21 points.

This code is intentionally lightweight for hackathon use. Feel free to expand upon it!
