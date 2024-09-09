const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const app = express();
const port = 3000;

// Logging function
function logError(message) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ${message}`);
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Load users
const usersFilePath = path.join(__dirname, 'users.json');
function loadUsers() {
    try {
        const data = fs.readFileSync(usersFilePath, 'utf-8');
        return JSON.parse(data).users || [];
    } catch (error) {
        logError(`Error loading users: ${error.message}`);
        return [];
    }
}

let users = loadUsers();

// Middleware to log session
app.use((req, res, next) => {
    if (req.session.username) {
        console.log(`Session User: ${req.session.username}`);
    } else {
        console.log('Session User: No active session');
    }
    next();
});

// Serve pages without .html extension
app.get(['/', '/signup', '/login'], (req, res) => {
    const fileName = req.path === '/' ? 'index' : req.path.slice(1);
    res.sendFile(path.join(__dirname, 'public', `${fileName}.html`));
});

// Serve dashboard (only if logged in)
app.get('/dashboard', (req, res) => {
    if (!req.session.username) {
        logError('Unauthorized access attempt to dashboard');
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Serve bio data (JSON) for API requests
app.get('/api/:username', (req, res) => {
    const username = req.params.username;
    const bioFilePath = path.join(__dirname, 'public', 'users', `${username}.json`);

    if (!fs.existsSync(bioFilePath)) {
        logError(`Bio not found for user ${username}`);
        return res.status(404).json({ error: 'Bio not found!' });
    }

    try {
        const bioData = JSON.parse(fs.readFileSync(bioFilePath, 'utf-8'));
        res.json(bioData);
    } catch (error) {
        logError(`Error reading bio file for user ${username}: ${error.message}`);
        res.status(500).json({ error: 'Error reading bio data!' });
    }
});

// Serve bio page (HTML) for browsing
app.get('/:username', (req, res) => {
    const username = req.params.username;
    const bioFilePath = path.join(__dirname, 'public', 'users', `${username}.json`);

    if (!fs.existsSync(bioFilePath)) {
        logError(`Bio not found for user ${username}`);
        return res.status(404).send('Bio not found!');
    }

    res.sendFile(path.join(__dirname, 'public', 'bio.html'));
});

// Catch-all for non-existent routes
app.use((req, res) => {
    res.redirect('/');
});

// Signup POST request
app.post('/signup', (req, res) => {
    const { username, email, password } = req.body;
    users = loadUsers();

    if (users.some(user => user.username === username)) {
        logError(`Signup attempt failed: Username ${username} already exists.`);
        return res.status(400).send('Username already exists!');
    }

    users.push({ username, email, password });
    fs.writeFileSync(usersFilePath, JSON.stringify({ users }, null, 2));

    // Create user bio file
    const bioFilePath = path.join(__dirname, 'public', 'users', `${username}.json`);
    fs.writeFileSync(bioFilePath, JSON.stringify({
        username,
        bio: "Welcome to my bio!",
        link: "https://instagram.com/username" // default Instagram link
    }, null, 2));

    req.session.username = username;
    console.log(`Signup successful: User ${username}`);
    res.redirect('/dashboard');
});

// Login POST request
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    users = loadUsers();

    const user = users.find(user => user.username === username);
    if (!user || user.password !== password) {
        logError(`Login failed for user ${username}. Invalid credentials.`);
        return res.status(401).send('Invalid credentials!');
    }

    req.session.username = username;
    console.log(`Login successful: User ${username}`);
    res.redirect('/dashboard');
});

// Logout route
app.get('/logout', (req, res) => {
    const username = req.session.username;
    req.session.destroy(err => {
        if (err) {
            logError(`Error logging out user ${username}: ${err.message}`);
            return res.status(500).send('Error logging out.');
        }
        console.log(`Logout successful: User ${username}`);
        res.redirect('/');
    });
});

// Serve bios page for the logged-in user
app.get('/bios', (req, res) => {
    const username = req.session.username;
    if (!username) {
        logError('Bio not found for user: No user logged in');
        return res.status(403).send('Unauthorized: No user logged in.');
    }

    const bioFilePath = path.join(__dirname, 'public', 'users', `${username}.json`);
    if (!fs.existsSync(bioFilePath)) {
        logError(`Bio not found for user ${username}`);
        return res.status(404).send('Bio not found!');
    }

    res.sendFile(bioFilePath);
});

// Update bio POST request
app.post('/updatebio', (req, res) => {
    const { bio, link } = req.body;
    const username = req.session.username;

    if (!username) {
        logError('Unauthorized bio update attempt: No active session');
        return res.status(403).send('Unauthorized: No active session!');
    }

    const bioFilePath = path.join(__dirname, 'public', 'users', `${username}.json`);
    if (!fs.existsSync(bioFilePath)) {
        logError(`Bio update failed: User ${username} not found.`);
        return res.status(404).send('User not found!');
    }

    fs.writeFileSync(bioFilePath, JSON.stringify({ username, bio, link }, null, 2));
    console.log(`Bio updated successfully for user ${username}`);
    res.send('Bio updated successfully!');
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
