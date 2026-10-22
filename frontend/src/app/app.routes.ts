import { Routes } from '@angular/router';
import { AdminComponent } from './admin/admin.component';
import { authGuard } from './auth/auth.guard';
import { CallbackComponent } from './auth/callback.component';
import { roleGuard } from './auth/role.guard';
import { DashboardComponent } from './dashboard/dashboard.component';
import { ForbiddenComponent } from './shared/forbidden.component';

export const routes: Routes = [
  { path: 'callback', component: CallbackComponent },
  { path: 'forbidden', component: ForbiddenComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [authGuard, roleGuard],
    data: { role: 'ADMIN' },
  },
  { path: '', pathMatch: 'full', redirectTo: '/dashboard' },
  { path: '**', redirectTo: '/dashboard' },
];
