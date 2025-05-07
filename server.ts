import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Database } from 'bun:sqlite';

// Initialize database
const db = new Database(':memory:'); // Using in-memory DB for development
initializeDatabase();

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: '*', // In production, replace with your frontend URL
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok' });
});

// API routes
app.get('/api/podcasts', async (c) => {
  try {
    const podcasts = db.prepare(`
      SELECT p.*, u.username as author_name 
      FROM podcasts p 
      JOIN users u ON p.author_id = u.id 
      ORDER BY p.created_at DESC
    `).all();
    
    return c.json({ success: true, data: podcasts });
  } catch (error) {
    console.error('Error fetching podcasts:', error);
    return c.json({ success: false, message: 'Failed to fetch podcasts' }, 500);
  }
});

app.get('/api/podcasts/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const podcast = db.prepare(`
      SELECT p.*, u.username as author_name 
      FROM podcasts p 
      JOIN users u ON p.author_id = u.id 
      WHERE p.id = ?
    `).get(id);
    
    if (!podcast) {
      return c.json({ success: false, message: 'Podcast not found' }, 404);
    }
    
    const episodes = db.prepare(`
      SELECT * FROM episodes 
      WHERE podcast_id = ? 
      ORDER BY published_at DESC
    `).all(id);
    
    return c.json({ 
      success: true, 
      data: { ...podcast, episodes } 
    });
  } catch (error) {
    console.error(`Error fetching podcast with ID ${id}:`, error);
    return c.json({ success: false, message: 'Failed to fetch podcast' }, 500);
  }
});

// Function to initialize the database with sample data
function initializeDatabase() {
  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS podcasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      cover_image_url TEXT,
      author_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users (id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      podcast_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      audio_url TEXT NOT NULL,
      duration INTEGER NOT NULL,
      published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (podcast_id) REFERENCES podcasts (id)
    )
  `);

  // Insert sample data
  // Check if we already have users
  const userCountResult = db.prepare("SELECT COUNT(*) as user_count FROM users").get();
  const userCount = userCountResult ? (userCountResult as { user_count: number }).user_count : 0;
  
  if (userCount === 0) {
    // Insert sample users
    db.run(`
      INSERT INTO users (username, email) VALUES 
      ('johndoe', 'john@example.com'),
      ('janedoe', 'jane@example.com')
    `);

    // Insert sample podcasts
    db.run(`
      INSERT INTO podcasts (title, description, cover_image_url, author_id) VALUES 
      ('Tech Talk', 'A podcast about the latest in technology', 'https://placehold.co/400x400?text=Tech+Talk', 1),
      ('Science Hour', 'Exploring scientific discoveries', 'https://placehold.co/400x400?text=Science+Hour', 2),
      ('Coding Corner', 'Tips and tricks for developers', 'https://placehold.co/400x400?text=Coding+Corner', 1)
    `);

    // Insert sample episodes
    db.run(`
      INSERT INTO episodes (podcast_id, title, description, audio_url, duration) VALUES 
      (1, 'The Future of AI', 'Discussing advancements in artificial intelligence', 'https://example.com/episode1.mp3', 1800),
      (1, 'Web Development Trends', 'Latest trends in web development', 'https://example.com/episode2.mp3', 2100),
      (2, 'Quantum Computing Explained', 'An introduction to quantum computing', 'https://example.com/episode3.mp3', 1500),
      (3, 'Clean Code Principles', 'How to write maintainable code', 'https://example.com/episode4.mp3', 1920)
    `);
  }

  console.log('Database initialized with sample data');
}

// Test function for database connection
async function testConnection() {
  try {
    console.log('Testing database connection...');
    const result = db.prepare("SELECT 'Connection successful' as message").get();
    console.log(result ? (result as { message: string }).message : 'Connection failed');
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

// Initialize the server
const port = parseInt(process.env.PORT || '3000');
console.log(`Server starting on port ${port}...`);

export default {
  port,
  fetch: app.fetch,
};
