// question-interceptor.service.ts
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class QuestionInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      map(event => {
        if (event instanceof HttpResponse && req.url.includes('/api/quiz')) {
          // Remove isCorrect field from the response
          const sanitizedBody = this.removeIsCorrectFields(event.body);
          return event.clone({ body: sanitizedBody });
        }
        return event;
      })
    );
  }

  private removeIsCorrectFields(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeIsCorrectFields(item));
    } else if (obj !== null && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (key !== 'isCorrect') {
          sanitized[key] = this.removeIsCorrectFields(obj[key]);
        }
      }
      return sanitized;
    }
    return obj;
  }
}