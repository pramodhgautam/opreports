import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { AuthService, type AuthProfile } from './auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);

  readonly user = this.auth.user;
  readonly isAuthenticated = this.auth.isAuthenticated;
  readonly whoami = signal<AuthProfile | null>(null);
  readonly whoamiError = signal<string | null>(null);

  ngOnInit(): void {
    this.refreshWhoami();
  }

  refreshWhoami(): void {
    this.http.get<AuthProfile>(`${environment.apiBaseUrl}/auth/whoami`).subscribe({
      next: (profile) => {
        this.whoami.set(profile);
        this.whoamiError.set(null);
      },
      error: (error: unknown) => {
        this.whoamiError.set(error instanceof Error ? error.message : String(error));
      },
    });
  }

  login(): void {
    this.auth.login();
  }

  logout(): void {
    this.auth.logout();
  }
}
