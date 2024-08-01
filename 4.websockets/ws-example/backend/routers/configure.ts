import express, { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
import api from './api.js';
import { fileURLToPath } from "url";


// const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function configure(app: Application) {
  app
    .get('/', (req, res, next) => {
      res.sendFile(path.resolve(__dirname, '../../frontend/index.html'));
    })
    .use(express.static('frontend'))
    .use(express.json())
    .use('/api', api())
    .use('/error', (req, res, next) => {
      next(new Error('Other Error'));
    })
    .use((req, res, next) => {
      next(new Error('Not Found'));
    })
    .use((error: Error, req: Request, res: Response, next: NextFunction) => {
      if (error.message === 'Not Found') {
        res.sendFile(path.resolve(__dirname, '../../frontend/not-found.html'));
        return;
      }

      res.sendFile(path.resolve(__dirname, '../../frontend/error.html'));
    });
}
