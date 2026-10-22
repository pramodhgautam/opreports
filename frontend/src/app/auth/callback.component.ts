import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

/** Landing route after Keycloak redirects back with the authorization code. */
@Component({
  selector: 'app-callback',
  template: `<p>Signing you in…</p>`,
})
export class CallbackComponent implements OnInit {
  constructor(private readonly router: Router) {}

  ngOnInit(): void {
    this.router.navigateByUrl('/dashboard');
  }
}
