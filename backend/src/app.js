import express from 'express';
import cors from 'cors';
import { requestLogger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { patientRouter } from './routes/patient.routes.js';
import { doctorRouter } from './routes/doctor.routes.js';
import { clinicalRouter } from './routes/clinical.routes.js';
import { voiceRouter } from './routes/voice.routes.js';
import { hospitalRouter } from './routes/hospital.routes.js';
import { departmentRouter } from './routes/department.routes.js';
import { encounterRouter } from './routes/encounter.routes.js';
import { documentRouter } from './routes/document.routes.js';
import { config } from './config/env.js';

export const app = express();

// Global Middleware
const allowedOrigins = [
  config.frontendUrl,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:')) ||
        origin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }
      return callback(new Error('CORS policy: Origin not allowed'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(requestLogger);

// API Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/patients', patientRouter);
app.use('/api/patient', patientRouter); // Legacy backward compatibility
app.use('/api/hospitals', hospitalRouter);
app.use('/api/departments', departmentRouter);
app.use('/api/encounters', encounterRouter);
app.use('/api/doctor', doctorRouter);
app.use('/api/clinical', clinicalRouter);
app.use('/api/documents', documentRouter);
app.use('/api/voice', voiceRouter);

// Centralized Error Handling
app.use(errorHandler);
