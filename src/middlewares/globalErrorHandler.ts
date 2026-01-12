import { ErrorRequestHandler, Request, Response } from 'express';
import { ZodError, ZodIssue } from 'zod';
import mongoose, { Error as MongooseError } from 'mongoose';
import config from '../config/index.js';
import { IErrorSources } from '../interface/error.js';

// ---- Helper: standardized error response ----
const sendErrorResponse = (
  res: Response,
  statusCode: number,
  message: string,
  errorSources: IErrorSources,
  stack?: string
): Response => {
  return res.status(statusCode).json({
    success: false,
    message,
    errorSources,
    ...(stack ? { stack } : {}),
  });
};

// ---- Handle Zod validation error ----
const handleZodError = (
  err: ZodError
): {
  statusCode: number;
  message: string;
  errorSources: IErrorSources;
} => {
  const errorSources: IErrorSources = err.issues.map((issue: ZodIssue) => ({
    path: issue.path.length ? String(issue.path[issue.path.length - 1]) : '',
    message: issue.message,
  }));

  return { statusCode: 400, message: 'Validation Error', errorSources };
};

// ---- Handle Mongoose validation error ----
const handleMongooseValidationError = (
  err: MongooseError.ValidationError
): { statusCode: number; message: string; errorSources: IErrorSources } => {
  const errorSources: IErrorSources = Object.values(err.errors).map(val => ({
    path: val.path,
    message: val.message,
  }));

  return { statusCode: 400, message: 'Validation Error', errorSources };
};

// ---- Handle Mongoose cast error ----
const handleMongooseCastError = (
  err: MongooseError.CastError
): { statusCode: number; message: string; errorSources: IErrorSources } => {
  const errorSources: IErrorSources = [{ path: err.path, message: err.message }];
  return { statusCode: 400, message: 'Invalid ID', errorSources };
};

// ---- Handle duplicate key error ----
const handleMongooseDuplicateError = (err: {
  message: string;
}): { statusCode: number; message: string; errorSources: IErrorSources } => {
  const match = err.message.match(/"([^"]*)"/);
  const extracted = match?.[1];
  const errorSources: IErrorSources = [
    {
      path: '',
      message: `${extracted || 'The value'} already exists.`,
    },
  ];
  return { statusCode: 409, message: 'Duplicate Key Error', errorSources };
};

// ---- Type guards ----
const hasCode = (err: unknown): err is { code: number } =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  typeof (err as { code: unknown }).code === 'number';

const hasMessage = (err: unknown): err is { message: string } =>
  typeof err === 'object' &&
  err !== null &&
  'message' in err &&
  typeof (err as { message: unknown }).message === 'string';

// ---- Global Error Handler ----
const globalErrorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response
): Response => {
  let statusCode = 500;
  let message = 'Something went wrong!';
  let errorSources: IErrorSources = [{ path: '', message }];

  if (err instanceof ZodError) {
    ({ statusCode, message, errorSources } = handleZodError(err));
  } else if (err instanceof mongoose.Error.ValidationError) {
    ({ statusCode, message, errorSources } = handleMongooseValidationError(err));
  } else if (err instanceof mongoose.Error.CastError) {
    ({ statusCode, message, errorSources } = handleMongooseCastError(err));
  } else if (hasCode(err) && err.code === 11000 && hasMessage(err)) {
    ({ statusCode, message, errorSources } = handleMongooseDuplicateError(err));
  } else if (err instanceof Error) {
    message = err.message;
    errorSources = [{ path: '', message }];
  }

  return sendErrorResponse(
    res,
    statusCode,
    message,
    errorSources,
    config.node_env === 'development' && err instanceof Error ? err.stack : undefined
  );
};

export default globalErrorHandler;
