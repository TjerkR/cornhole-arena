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

// --- Player and Location Endpoints ---

// Get all players
app.get('/players', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM Players');
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Create new player
app.post('/players', async (req, res) => {
  const { name, email, locationId } = req.body;
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .input('email', sql.NVarChar, email)
      .input('locationId', sql.Int, locationId)
      .query(`INSERT INTO Players (Name, EmailAddress, _Locations_ID)
              OUTPUT INSERTED._Players_ID
              VALUES (@name, @email, @locationId)`);
    res.json({ playerId: result.recordset[0]._Players_ID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add player' });
  }
});

// Get all locations
app.get('/locations', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM Locations');
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// Create new location
app.post('/locations', async (req, res) => {
  const { name } = req.body;
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('name', sql.NVarChar, name)
      .query(`INSERT INTO Locations (Name)
              OUTPUT INSERTED._Locations_ID
              VALUES (@name)`);
    res.json({ locationId: result.recordset[0]._Locations_ID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add location' });
  }
});

app.post('/games', async (req, res) => {
  const { team1Player1, team1Player2, team2Player1, team2Player2 } = req.body;
  try {
    const pool = await getPool();
    // Ensure all players exist
    const check = await pool.request()
      .input('p1', sql.Int, team1Player1)
      .input('p2', sql.Int, team1Player2)
      .input('p3', sql.Int, team2Player1)
      .input('p4', sql.Int, team2Player2)
      .query(`SELECT COUNT(*) AS cnt FROM Players WHERE _Players_ID IN (@p1,@p2,@p3,@p4)`);
    if (check.recordset[0].cnt !== 4) {
      return res.status(400).json({ error: 'One or more players do not exist' });
    }

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
    const gameRes = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT * FROM Games WHERE _Games_ID = @id');
    const eventsRes = await pool.request()
      .input('gameId', sql.Int, req.params.id)
      .query('SELECT * FROM GameEvents WHERE _Games_ID = @gameId ORDER BY Timestamp ASC');

    let team1 = 0;
    let team2 = 0;
    for (const ev of eventsRes.recordset) {
      team1 += ev.PointsTeam1;
      team2 += ev.PointsTeam2;
    }

    const game = gameRes.recordset[0];
    game.ScoreTeam1 = team1;
    game.ScoreTeam2 = team2;

    res.json({ game, events: eventsRes.recordset });
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

    const eventsRes = await pool.request()
      .input('gameId', sql.Int, req.params.id)
      .query('SELECT PointsTeam1, PointsTeam2 FROM GameEvents WHERE _Games_ID = @gameId');

    let t1 = 0;
    let t2 = 0;
    for (const ev of eventsRes.recordset) {
      t1 += ev.PointsTeam1;
      t2 += ev.PointsTeam2;
    }

    if (t1 >= 21 || t2 >= 21) {
      const winner = t1 >= 21 ? 1 : 2;

      await pool.request()
        .input('status', sql.NVarChar, 'complete')
        .input('winner', sql.Int, winner)
        .input('team1', sql.Int, t1)
        .input('team2', sql.Int, t2)
        .input('id', sql.Int, req.params.id)
        .query(`UPDATE Games SET Status=@status, Winner=@winner, Team1Score=@team1, Team2Score=@team2, CompletedAt=GETDATE() WHERE _Games_ID=@id`);

      const gameRes = await pool.request()
        .input('id', sql.Int, req.params.id)
        .query('SELECT _Team1_Player1_ID, _Team1_Player2_ID, _Team2_Player1_ID, _Team2_Player2_ID FROM Games WHERE _Games_ID=@id');
      const g = gameRes.recordset[0];
      const winners = winner === 1 ? [g._Team1_Player1_ID, g._Team1_Player2_ID] : [g._Team2_Player1_ID, g._Team2_Player2_ID];
      const losers = winner === 1 ? [g._Team2_Player1_ID, g._Team2_Player2_ID] : [g._Team1_Player1_ID, g._Team1_Player2_ID];

      for (const pid of winners) {
        await pool.request()
          .input('pid', sql.Int, pid)
          .query('UPDATE Players SET Wins = ISNULL(Wins,0)+1 WHERE _Players_ID=@pid');
      }
      for (const pid of losers) {
        await pool.request()
          .input('pid', sql.Int, pid)
          .query('UPDATE Players SET Losses = ISNULL(Losses,0)+1 WHERE _Players_ID=@pid');
      }
    }

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
