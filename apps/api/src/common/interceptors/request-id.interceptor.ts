import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<
      Request & { id?: string; requestId?: string }
    >();
    const res = http.getResponse<Response>();
    const incoming = req.header('x-request-id');
    const requestId = incoming && incoming.length > 0 ? incoming : randomUUID();
    req.requestId = requestId;
    // Keep string form even if a logger later assigns a numeric req.id
    if (typeof req.id !== 'string') {
      req.id = requestId;
    }
    res.setHeader('x-request-id', requestId);
    return next.handle();
  }
}
