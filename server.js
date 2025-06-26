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
      .input('team1Player1', sql.Int, team1Player1)
      .input('team1Player2', sql.Int, team1Player2)
      .input('team2Player1', sql.Int, team2Player1)
      .input('team2Player2', sql.Int, team2Player2)
      .query(`INSERT INTO Games (_Team1_Player1_ID, _Team1_Player2_ID, _Team2_Player1_ID, _Team2_Player2_ID, Status, StartedAt)
              OUTPUT INSERTED._Games_ID
              VALUES (@team1Player1, @team1Player2, @team2Player1, @team2Player2, 'ongoing', GETDATE())`);
    res.json({ gameId: result.recordset[0]._Games_ID });
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
      .query('SELECT * FROM Games WHERE _Games_ID = @id');
    const events = await pool.request()
      .input('gameId', sql.Int, req.params.id)
      .query('SELECT * FROM GameEvents WHERE _Games_ID = @gameId ORDER BY Timestamp ASC');
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
      .query(`INSERT INTO GameEvents (_Games_ID, Name, EventType, PointsTeam1, PointsTeam2, Timestamp)
              VALUES (@gameId, @eventType, @eventType, @pointsTeam1, @pointsTeam2, GETDATE())`);
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
