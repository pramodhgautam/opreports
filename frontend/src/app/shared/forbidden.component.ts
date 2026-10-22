import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden',
  imports: [RouterLink],
  template: `
    <h1>Forbidden</h1>
    <p>You do not have access to this area.</p>
    <a routerLink="/dashboard">Back to dashboard</a>
  `,
})
export class ForbiddenComponent {}
