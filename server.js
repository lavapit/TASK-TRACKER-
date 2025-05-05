const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());


const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Lavapit@2005',
    database: 'dbmss',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        throw err;
    }
    console.log('MySQL Connected...');
    connection.release();
});

app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    const password_hash = await bcrypt.hash(password, 10);
    const role = 'User';

    const query = 'INSERT INTO Users (username, email, password_hash, role) VALUES (?, ?, ?, ?)';
    db.query(query, [username, email, password_hash, role], (err, result) => {
        if (err) {
            console.error('Error registering user:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ message: 'Username or email already exists' });
            }
            return res.status(500).json({ message: 'Server error', error: err.message });
        }
        res.status(201).json({ message: 'User registered successfully', user_id: result.insertId });
    });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    const query = 'SELECT * FROM Users WHERE email = ?';
    db.query(query, [email], async (err, results) => {
        if (err) {
            console.error('Error during login:', err);
            return res.status(500).json({ message: 'Server error', error: err.message });
        }
        if (results.length === 0) return res.status(400).json({ message: 'User not found' });

        const user = results[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(400).json({ message: 'Invalid password' });

        res.json({ message: 'Login successful', user_id: user.user_id, username: user.username });
    });
});

app.get('/tasks/:user_id', (req, res) => {
    const { user_id } = req.params;
    const query = `
        SELECT t.*, p.project_name, u.username AS assigned_to
        FROM Tasks t
        LEFT JOIN Projects p ON t.project_id = p.project_id
        LEFT JOIN Users u ON t.assigned_to = u.user_id
        WHERE t.assigned_to = ? OR t.assigned_to IS NULL`;
    db.query(query, [user_id], (err, results) => {
        if (err) {
            console.error('Error fetching tasks:', err);
            return res.status(500).json({ message: 'Server error', error: err.message });
        }
        res.json(results);
    });
});

app.post('/tasks', (req, res) => {
    const { project_id, assigned_to, title, description, priority, status, due_date } = req.body;

    if (!title || !priority || !status) {
        return res.status(400).json({ message: 'Title, priority, and status are required' });
    }

    const validPriorities = ['Low', 'Medium', 'High'];
    const validStatuses = ['To Do', 'In Progress', 'Completed', 'Blocked'];
    if (!validPriorities.includes(priority)) {
        return res.status(400).json({ message: 'Invalid priority value' });
    }
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
    }

    const query = 'INSERT INTO Tasks (project_id, assigned_to, title, description, priority, status, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)';
    db.query(query, [project_id || null, assigned_to || null, title, description || null, priority, status, due_date || null], (err, result) => {
        if (err) {
            console.error('Error creating task:', err);
            if (err.code === 'ER_NO_REFERENCED_ROW_2') {
                return res.status(400).json({ message: 'Invalid project_id or assigned_to user does not exist' });
            }
            return res.status(500).json({ message: 'Server error', error: err.message });
        }
        res.status(201).json({ message: 'Task created', task_id: result.insertId });
    });
});

app.put('/tasks/:task_id', (req, res) => {
    const { task_id } = req.params;
    const { status } = req.body;

    const validStatuses = ['To Do', 'In Progress', 'Completed', 'Blocked'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
    }

    const query = 'UPDATE Tasks SET status = ? WHERE task_id = ?';
    db.query(query, [status, task_id], (err) => {
        if (err) {
            console.error('Error updating task:', err);
            return res.status(500).json({ message: 'Server error', error: err.message });
        }
        res.json({ message: 'Task updated' });
    });
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});