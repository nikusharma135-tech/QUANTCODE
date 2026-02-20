const express = require('express');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'quant-sum-ode-secret',
    resave: false,
    saveUninitialized: false
}));

// --- DATABASE SETUP ---
const DB_FILE = path.join(__dirname, 'database.json');
function loadData() {
    if (!fs.existsSync(DB_FILE)) {
        const defaultData = {
            users: [{ username: 'shreyash_251120', password: '25112006uch', role: 'superadmin', createdAt: new Date().toLocaleString() }],
            notifications: [], materials: [], 
            team: {} // <-- NEW: Stores all dynamic team names!
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function saveData(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }
let db = loadData();

// --- FILE STORAGE ---
const uploadDir = path.join(__dirname, 'public', 'uploads');
const teamDir = path.join(__dirname, 'public', 'team');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(teamDir)) fs.mkdirSync(teamDir, { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir); },
    filename: function (req, file, cb) { cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_')); }
});
const upload = multer({ storage: storage });
const teamUpload = multer({ dest: teamDir });

// --- ROUTES ---
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.post('/api/login', (req, res) => {
    db = loadData();
    const user = db.users.find(u => u.username === req.body.username && u.password === req.body.password);
    if (user) {
        req.session.userId = user.username;
        req.session.role = user.role;
        res.json({ success: true, role: user.role });
    } else res.status(401).json({ success: false, message: 'Access Denied' });
});

app.get('/api/dashboard-data', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ loggedIn: false });
    db = loadData(); 
    if (req.session.role === 'admin' || req.session.role === 'superadmin') {
        res.json({ loggedIn: true, role: req.session.role, username: req.session.userId, users: db.users, notifications: db.notifications, materials: db.materials });
    } else {
        res.json({ loggedIn: true, role: 'member', username: req.session.userId, notifications: db.notifications, materials: db.materials });
    }
});

// PUBLIC ROUTE: Fetch dynamic team names
app.get('/api/team', (req, res) => {
    db = loadData();
    res.json(db.team || {});
});

// SUPER ADMIN: Update Name, Tag, AND Photo
app.post('/api/superadmin/update-team-member', teamUpload.single('photo'), (req, res) => {
    if (req.session.role !== 'superadmin') return res.status(403).json({ success: false, message: 'Forbidden' });
    
    const { roleId, memberName, memberTag } = req.body;
    if (!roleId) return res.status(400).json({ success: false });

    // 1. Save Text Data to Database
    db = loadData();
    if (!db.team) db.team = {};
    
    // Only update if the user actually typed something
    if (memberName) {
        if (!db.team[roleId]) db.team[roleId] = {};
        db.team[roleId].name = memberName;
    }
    if (memberTag !== undefined) {
        if (!db.team[roleId]) db.team[roleId] = {};
        db.team[roleId].tag = memberTag;
    }
    saveData(db);

    // 2. Save Image if uploaded
    if (req.file) {
        const tempPath = req.file.path;
        const targetPath = path.join(teamDir, roleId + '.jpg');
        fs.renameSync(tempPath, targetPath);
    }
    
    res.json({ success: true });
});

app.post('/api/admin/add-user', (req, res) => {
    if (req.session.role !== 'admin' && req.session.role !== 'superadmin') return res.status(403).send('Forbidden');
    db = loadData();
    if (db.users.find(u => u.username === req.body.newUsername)) return res.status(400).json({ success: false, message: 'Exists' });
    let assignedRole = (req.session.role === 'superadmin' && req.body.newRole === 'admin') ? 'admin' : 'member';
    db.users.push({ username: req.body.newUsername, password: req.body.newPassword, role: assignedRole, createdAt: new Date().toLocaleString() });
    saveData(db); res.json({ success: true });
});

app.delete('/api/admin/delete-user/:username', (req, res) => {
    if (req.session.role !== 'superadmin') return res.status(403).json({ success: false });
    if (req.params.username === 'shreyash_251120') return res.status(400).json({ success: false });
    db = loadData();
    db.users = db.users.filter(u => u.username !== req.params.username);
    saveData(db); res.json({ success: true });
});

app.post('/api/admin/add-material', upload.single('file'), (req, res) => {
    if (req.session.role !== 'admin' && req.session.role !== 'superadmin') return res.status(403).send('Forbidden');
    const { title, type, link } = req.body;
    let finalLink = req.file ? '/uploads/' + req.file.filename : link;
    db = loadData();
    db.materials.unshift({ id: Date.now(), title, type, link: finalLink, date: new Date().toLocaleString() });
    saveData(db); res.json({ success: true });
});

app.post('/api/admin/notify', (req, res) => {
    if (req.session.role !== 'admin' && req.session.role !== 'superadmin') return res.status(403).send('Forbidden');
    db = loadData();
    db.notifications.unshift({ id: Date.now(), text: req.body.text, date: new Date().toLocaleString() });
    saveData(db); res.json({ success: true });
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });

// The cloud server provides its own port via process.env.PORT
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`QUANT∑ODE server running on port ${PORT}`));