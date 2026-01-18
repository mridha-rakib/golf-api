// file: src/app.ts
import type { Application, NextFunction, Request, Response } from "express";

import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { errorHandler } from "@/middlewares/error-handler.middleware";
import { notFound } from "@/middlewares/not-found.middleware";
import rootRouter from "@/routes/index.route.js";

import swaggerUi from "swagger-ui-express";

import { swaggerSpec, swaggerUiOptions } from "./config/swagger.config.js";
import { env } from "./env.js";
import { pinoLogger } from "./middlewares/pino-logger.js";

type RawBodyRequest = Request & { rawBody?: string };

const app: Application = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(
  express.json({
    verify: (req: RawBodyRequest, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    },
  })
);
app.use(
  (
    error: any,
    req: RawBodyRequest,
    _res: Response,
    next: NextFunction
  ) => {
    if (
      error instanceof SyntaxError &&
      (req.rawBody?.trim().length ?? 0) === 0
    ) {
      req.body = {};
      return next();
    }
    return next(error);
  }
);
app.use(pinoLogger());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));
app.use(helmet());

app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    ...swaggerUiOptions,
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: "alpha",
      operationsSorter: "method",
    },
  })
);

app.get<object>("/", (req, res) => {
  res.json({
    message: "Golf-Social-media-API",
  });
});

app.use(env.BASE_URL, rootRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
