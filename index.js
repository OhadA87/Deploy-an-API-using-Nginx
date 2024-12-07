const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const client = require('prom-client');

const app = express();
app.use(express.json());
app.use(morgan('dev'));

// Metrics setup
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

const requestCounter = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'],
});

// Middleware for metrics
app.use((req, res, next) => {
    res.on('finish', () => {
        requestCounter.inc({
            method: req.method,
            route: req.route ? req.route.path : 'unknown',
            status: res.statusCode,
        });
    });
    next();
});

// Environment variables
const PORT = process.env.PORT || 3000;
require('dotenv').config();
const SECRET_KEY = process.env.NODE_KEY || 'defaultsecretkey';

// API Router for all routes under /api
const apiRouter = express.Router();

apiRouter.get('/', (req, res) => {
    res.json({ message: 'Awesome API using Express node' });
});

apiRouter.get('/hashme', (req, res) => {
    const hashstring = 'I am hashed';
    const hash = bcrypt.hashSync(hashstring, 10);
    res.json({ hash });
});

apiRouter.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'admin' && password === 'password') {
        const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token });
    } else {
        res.status(401).json({ message: 'Unauthorized' });
    }
});

apiRouter.get('/secure-data', authenticateToken, (req, res) => {
    res.json({ data: 'This is secure data only visible with a valid token.' });
});

apiRouter.get('/health', (req, res) => {
    res.json({ status: 'UP', timestamp: new Date() });
});

apiRouter.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
});

// Middleware to verify JWT
function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.sendStatus(403);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Use /api as the base path
app.use('/api', apiRouter);

app.use(express.json());

// Starting the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
