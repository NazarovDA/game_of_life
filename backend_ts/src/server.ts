import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
// import helmet from 'helmet';
// import compression from 'compression';

import { notFound, errorHandler } from './middlewares';
import routes from './routes';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 'uniquelocal');
app.use(
  process.env.NODE_ENV === 'production'
    ? morgan('combined', { skip: (req, res) => res.statusCode < 400 })
    : morgan('dev'),
);
// app.use(helmet({
//   crossOriginResourcePolicy: false,
// }));
app.use(cors());
// app.use(compression());
app.use(express.json({ limit: '1mb' }));
if (process.env.NODE_ENV !== 'production') {
  app.set('json spaces', 2);
}

app.use('/', routes);

app.use(notFound);
app.use(errorHandler);

export { app };
export default app;