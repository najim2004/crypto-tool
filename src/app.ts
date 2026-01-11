import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import pinoHttpMiddleware from './middlewares/requestLogger';

// <new-import-here> -- DO NOT REMOVE (Used by nxpcli)

const app: Application = express();

// Middlewares
app.use(pinoHttpMiddleware);
app.use(express.json());
app.use(cors({
  origin: '*', // configure as needed
  credentials: true,
}));

// <new-route-here> -- DO NOT REMOVE (Used by nxpcli)

// Health check route
app.get('/', (req: Request, res: Response):void => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the Express Pro server! (ESM Edition)',
  });
});

export default app;
