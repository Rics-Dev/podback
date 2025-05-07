import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

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
    const podcasts = await db.query(
      `SELECT p.*, u.username as author_name 
       FROM podcasts p 
       JOIN users u ON p.author_id = u.id 
       ORDER BY p.created_at DESC`
    );
    return c.json({ success: true, data: podcasts });
  } catch (error) {
    console.error('Error fetching podcasts:', error);
    return c.json({ success: false, message: 'Failed to fetch podcasts' }, 500);
  }
});

app.get('/api/podcasts/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const [podcast] = await db.query(
      `SELECT p.*, u.username as author_name 
       FROM podcasts p 
       JOIN users u ON p.author_id = u.id 
       WHERE p.id = ?`,
      [id]
    );
    
    if (!podcast) {
      return c.json({ success: false, message: 'Podcast not found' }, 404);
    }
    
    const episodes = await db.query(
      `SELECT * FROM episodes 
       WHERE podcast_id = ? 
       ORDER BY published_at DESC`,
      [id]
    );
    
    return c.json({ 
      success: true, 
      data: { ...podcast, episodes } 
    });
  } catch (error) {
    console.error(`Error fetching podcast with ID ${id}:`, error);
    return c.json({ success: false, message: 'Failed to fetch podcast' }, 500);
  }
});

// Initialize the server
async function startServer() {
  // Test the database connection
  await testConnection();
  
  // Start the server
  const port = parseInt(process.env.PORT || '3000');
  console.log(`Server starting on port ${port}...`);
  
  export default {
    port,
    fetch: app.fetch,
  };
}

startServer().catch(console.error);
