import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

const isApiRequest = (url: string): boolean =>
  url.startsWith(environment.apiBaseUrl) || url.startsWith('/api');

/**
 * Attaches `Authorization: Bearer <token>` to API requests. On a 401 it
 * performs a single refresh-token exchange (independent of the silent-refresh
 * iframe) and retries; if that fails it logs out.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url)) {
    return next(req);
  }

  const oauthService = inject(OAuthService);
  const withBearer = (request = req) =>
    request.clone({ setHeaders: { Authorization: `Bearer ${oauthService.getAccessToken()}` } });

  return next(withBearer(req)).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401) {
        return throwError(() => error);
      }
      return from(oauthService.refreshToken()).pipe(
        catchError(() => {
          oauthService.logOut();
          return throwError(() => error);
        }),
        switchMap(() => next(withBearer(req))),
      );
    }),
  );
};
