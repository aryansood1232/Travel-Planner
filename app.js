const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const db = require('./db');

require('dotenv').config();
const app = express();
const { GoogleGenAI } = require("@google/genai");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/js', express.static('public/js'));
app.use('/css', express.static('public/css'));
app.use('/html', express.static('public/html'));
app.use('/images', express.static('public/images'));
const ai = new GoogleGenAI({});
const PORT = 3028;

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
  secure: process.env.NODE_ENV === 'production', 
  httpOnly: true, 
  sameSite: 'lax', 
  maxAge: 1000 * 60 * 60 * 24
}
  
}));



// Middleware to protect dashboard
function isAuthenticated(req, res, next) {
  if (!req.session.username) {
    return res.redirect('/html/login.html');
  }
  next();
}

// ROUTES

app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send('Missing fields');

  const [user] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
  if (user.length > 0) return res.status(400).send('Username already exists');

  const hashed = await bcrypt.hash(password, 10);
  await db.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashed]);

  res.redirect('/html/login.html');
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).send('Username and password are required');
    }

    const [rows] = await db.execute('SELECT id, password FROM users WHERE username = ?', [username]);

    if (rows.length === 0) {
      return res.status(401).send('Invalid username or password');
    }

    const hashedPassword = rows[0].password;
    const isMatch = await bcrypt.compare(password, hashedPassword);

    if (isMatch) {
      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).send('Internal Server Error');
        }
        req.session.username = username;
        req.session.userId = rows[0].id;
        console.log(req.session.userId);
        res.redirect('/dashboard');
      });
    } else {
      return res.status(401).send('Invalid username or password');
    }
  } catch (error) {
    return res.status(500).send('Internal Server Error');
  }
});

app.get('/api/user-info', isAuthenticated, (req, res) => {
  if (!req.session.username) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ username: req.session.username });
});

app.post('/api/generate-itinerary',  async (req, res) => {
  try {
    const { destination, startDate, endDate, interests, prompt } = req.body;

    if (!destination || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Missing destination, startDate, or endDate'
      });
    }

    // Create the prompt for Gemini
    const userPrompt = `
You are a professional travel planner.

Create a **day-by-day travel itinerary** for a trip to ${destination}
from ${startDate} to ${endDate}.
Interests: ${interests || 'none specified'}.
Extra notes: ${prompt || 'none'}.

Format the output strictly as valid JSON with this structure:

{
  "tripSummary": "string",
  "days": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "title": "string",
      "activities": ["activity 1", "activity 2", "activity 3"]
    }
  ]
}
`

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: userPrompt
    });
    const itinerary = response.text;

    res.json({ success: true, itinerary });

  } catch (err) {
    console.error('Error generating itinerary:', err);
    res.status(500).json({ success: false, error: 'Error generating itinerary' });
  }
})

app.post('/api/save-trip', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.userId; 
    const { destination, startDate, endDate, itinerary } = req.body;

    if (!destination || !startDate || !endDate || !itinerary) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const itineraryStr = JSON.stringify(itinerary);

    const [result] = await db.query(
      `INSERT INTO trips (user_id, destination, start_date, end_date, itinerary, status)
       VALUES (?, ?, ?, ?, ?, 'saved')`,
      [userId, destination, startDate, endDate, itineraryStr]
    );

    res.json({ success: true, tripId: result.insertId });
  } catch (error) {
    console.error("Save Trip Error:", error); 
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/saved-trips', isAuthenticated, async (req, res) => {
  try {
    
    const userId = req.session.userId;

    const [rows] = await db.query(
      `SELECT id, destination, start_date, end_date, itinerary 
       FROM trips WHERE user_id = ? AND status = 'saved'`,
      [userId]
    );

    res.json({ success: true, trips: rows });
  } catch (err) {
    console.error("Error fetching trips:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

app.get('/api/complete-trips', isAuthenticated, async (req, res) => {
  try {
  
   const userId = req.session.userId;

    const [rows] = await db.query(
      `SELECT id, destination, start_date, end_date, itinerary 
       FROM trips WHERE user_id = ? AND status = 'completed'`,
      [userId]
    );

    res.json({ success: true, trips: rows });
  } catch (err) {
    console.error("Error fetching trips:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});



app.delete("/api/delete-trip/:id", isAuthenticated, async (req, res) => {
  const tripId = req.params.id;
  const userId = req.session.userId;

  try {
    const [result] = await db.query(
      "DELETE FROM trips WHERE id = ? AND user_id = ?",
      [tripId, userId]
    );

    if (result.affectedRows === 0) {
      return res.json({ success: false, error: "Trip not found or not authorized" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: "Database error" });
  }
});

app.patch("/api/complete-trip/:id", isAuthenticated, async (req, res) => {
  const tripId = req.params.id;
  const userId = req.session.userId; 

  try {
    const [result] = await db.query(
      "UPDATE trips SET status = 'completed' WHERE id = ? AND user_id = ?",
      [tripId, userId]
    );

    if (result.affectedRows === 0) {
      return res.json({ success: false, error: "Trip not found or not authorized" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: "Database error" });
  }
});

app.get("/api/trip/:id", isAuthenticated, async (req, res) => {
  const tripId = req.params.id;
  const userId = req.session.userId;
  try {
    const [rows] = await db.query("SELECT * FROM trips WHERE id = ? AND user_id = ?", [tripId, userId]);

    if (rows.length === 0) {
      return res.json({ success: false, error: "Trip not found" });
    }

    const trip = rows[0];

   
    if (trip.itinerary && typeof trip.itinerary === "string") {
      trip.itinerary = JSON.parse(trip.itinerary);
    }

    res.json({ success: true, trip });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: "Database error" });
  }
});

app.get("/api/google-maps-key", (req, res) => {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return res.status(500).json({ error: "API key not set" });
  }
  res.json({ key: process.env.GOOGLE_MAPS_API_KEY });
});

app.get('/trip.html', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/html/trip.html'));
});
app.get('/new-york', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/html/newyork.html'));
});
app.get('/japan', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/html/japan.html'));
});
app.get('/london', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/html/london.html'));
});

// Protect dashboard route with authentication middleware
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/html/login.html'));
});


app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/html/login.html'));
});

app.get('/signup.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/html/signup.html'));
});

app.get('/dashboard.html', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/html/dashboard.html'));
});

// Fixed typo route if needed (optional)
app.get('/dashboard', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/html/dashboard.html'));
});

app.get('/hawaii', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/html/hawaii.html'));
});

app.get('/saved-trip', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/html/saved-trips.html'));
});

app.get('/recent-trip', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/html/recent-trips.html'));
});

app.get('/new-trip', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/html/new-trip.html'));
});


app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/html/login.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
})
