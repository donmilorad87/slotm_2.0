import type { NextFunction, Request, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";

import type { RequestAuthWithUser } from "./domain.js";

export type AsyncRequestHandler<
  P extends ParamsDictionary = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery extends ParsedQs = ParsedQs,
> = (
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction,
) => void | Promise<void>;

export type AuthedRequest<
  P extends ParamsDictionary = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery extends ParsedQs = ParsedQs,
> = Request<P, ResBody, ReqBody, ReqQuery> & {
  auth: RequestAuthWithUser;
};

export function hasAuthenticatedUser(
  request: Request,
): request is AuthedRequest {
  return !!request.auth?.user;
}
