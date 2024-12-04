import { RequestHandler, ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { STATUS_CODES } from 'http';
import { AnyZodObject, ZodError } from 'zod';
// import { IgnorableError } from './httpErrors';

const notFound: RequestHandler = function notFound(req, res, next) {
  if (res.statusCode === 200) {
    res.status(404);
  }
  const error = new Error(STATUS_CODES[res.statusCode]);
  next(error);
};

const errorHandler: ErrorRequestHandler = function errorHandler(err, req, res, next) {
  // if (err instanceof IgnorableError) {
  //   // for special cases
  //   return;
  // }
  if (err.code && err.code < 600 && err.code >= 100) {
    res.status(err.code);
  } else if (res.statusCode === 200) {
    res.status(500);
  }

  if (process.env.NODE_ENV !== 'test' || res.statusCode >= 500) {
    console.error(err);
  }
  res.json({
    ok: false,
    code: res.statusCode,
    message: STATUS_CODES[res.statusCode],
    error: err instanceof ZodError ? "Validation failed" : err.message,
    issues: err instanceof ZodError ? err.errors : undefined,
    stack: res.statusCode === 404 || process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

export { notFound, errorHandler, };