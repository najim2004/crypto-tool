// src/middlewares/validateRequest.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodTypeAny } from 'zod';

const validateRequest =
  <T extends ZodTypeAny>(schema: T): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const errors = result.error.issues.map(i => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return res.status(400).json({ success: false, errors });
    }

    // optional: overwrite parsed, type-safe data back to req
    Object.assign(req, result.data);
    next();
  };

export default validateRequest;

