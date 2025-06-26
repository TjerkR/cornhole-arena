const express = require('express');
const sql = require('mssql');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  server: process.env.DB_SERVER, // e.g. 'localhost'
  database: process.env.DB_NAME,
  options: {
    trustServerCertificate: true
  }
};

let pool;
async function getPool() {
  if (!pool) {
    pool = await sql.connect(dbConfig);
  }
  return pool;
}

app.post('/games', async (req, res) => {
  const { team1Player1, team1Player2, team2Player1, team2Player2 } = req.body;
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('Team1Player1', sql.Int, team1Player1)
      .input('Team1Player2', sql.Int, team1Player2)
      .input('Team2Player1', sql.Int, team2Player1)
      .input('Team2Player2', sql.Int, team2Player2)
      .query(`INSERT INTO Games (Team1Player1, Team1Player2, Team2Player1, Team2Player2, Status) OUTPUT INSERTED.Id VALUES (@Team1Player1, @Team1Player2, @Team2Player1, @Team2Player2, 'ongoing')`);
    res.json({ gameId: result.recordset[0].Id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

app.get('/games/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const game = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM Games WHERE Id = @id');
    const events = await pool.request()
      .input('gameId', sql.Int, req.params.id)
      .query('SELECT * FROM Game_Events WHERE GameId = @gameId ORDER BY EventTime ASC');
    res.json({ game: game.recordset[0], events: events.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

app.post('/games/:id/events', async (req, res) => {
  const { eventType, pointsTeam1, pointsTeam2 } = req.body;
  try {
    const pool = await getPool();
    await pool.request()
      .input('gameId', sql.Int, req.params.id)
      .input('eventType', sql.NVarChar, eventType)
      .input('pointsTeam1', sql.Int, pointsTeam1)
      .input('pointsTeam2', sql.Int, pointsTeam2)
      .query(`INSERT INTO Game_Events (GameId, EventType, PointsTeam1, PointsTeam2, EventTime)
              VALUES (@gameId, @eventType, @pointsTeam1, @pointsTeam2, GETDATE())`);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add event' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
