import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({ 
    success: true, 
    data: { 
      status: 'OK', 
      timestamp: new Date().toISOString() 
    } 
  });
});

const PORT = process.env.PORT || 5572;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;