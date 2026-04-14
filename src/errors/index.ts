import { HTTP_STATUS } from "../consts/http-status";

export class AppError extends Error {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AppError";
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad Request") {
    super(HTTP_STATUS.BAD_REQUEST, message);
    this.name = "BadRequestError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(HTTP_STATUS.FORBIDDEN, message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not Found") {
    super(HTTP_STATUS.NOT_FOUND, message);
    this.name = "NotFoundError";
  }
}



