import { HttpClient } from '@angular/common/http';
import { computed, Injectable, signal } from '@angular/core';
import { OAuthService } from 'angular-oauth2-oidc';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { authConfig } from './auth.config';

export interface AuthProfile {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
  permissions: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly profileSignal = signal<AuthProfile | null>(null);
  private readonly profileLoadedSignal = signal<boolean>(false);

  /** The DB-backed user (roles/permissions resolved from Postgres). */
  readonly user = this.profileSignal.asReadonly();
  readonly profileLoaded = this.profileLoadedSignal.asReadonly();
  readonly isAuthenticated = computed(
    () => this.profileLoadedSignal() && this.profileSignal() !== null,
  );
  readonly permissions = computed(() => this.profileSignal()?.permissions ?? []);
  readonly roles = computed(() => this.profileSignal()?.roles ?? []);

  constructor(
    private readonly oauthService: OAuthService,
    private readonly http: HttpClient,
  ) {}

  /**
   * Runs once at bootstrap (APP_INITIALIZER). Loads discovery, completes a
   * pending code exchange (return from Keycloak), or redirects to Keycloak when
   * unauthenticated. When authenticated, sets up automatic silent refresh.
   */
  async init(): Promise<void> {
    this.oauthService.configure(authConfig);

    if (this.oauthService.hasValidAccessToken()) {
      await this.oauthService.loadDiscoveryDocument();
      this.oauthService.setupAutomaticSilentRefresh();
    } else {
      await this.oauthService.loadDiscoveryDocumentAndLogin();
      if (!this.oauthService.hasValidAccessToken()) {
        // initCodeFlow() redirect to Keycloak is in flight.
        return;
      }
      this.oauthService.setupAutomaticSilentRefresh();
    }

    await this.loadProfile();
  }

  async loadProfile(): Promise<void> {
    try {
      const profile = await firstValueFrom(
        this.http.get<AuthProfile>(`${environment.apiBaseUrl}/auth/whoami`),
      );
      this.profileSignal.set(profile);
      this.profileLoadedSignal.set(true);
    } catch (error) {
      this.profileLoadedSignal.set(false);
      // Do NOT log tokens; log only the failure reason.
      console.error('Failed to load user profile from whoami:', error);
    }
  }

  hasPermission(permission: string): boolean {
    return this.profileSignal()?.permissions.includes(permission) ?? false;
  }

  hasRole(role: string): boolean {
    return this.profileSignal()?.roles.includes(role) ?? false;
  }

  login(): void {
    this.oauthService.initCodeFlow();
  }

  logout(): void {
    this.oauthService.logOut();
  }
}
