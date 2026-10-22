import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { REQUEST_USER_CONTEXT } from './auth.types.js';
import type { AuthUser, RequestWithUserContext, UserContext } from './auth.types.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves the local user by idp_subject, auto-provisioning on first login
   * (default role VIEWER). Roles and permissions are always read from Postgres —
   * never trusted from Keycloak realm_access/resource_access claims.
   * The resolved context is cached on the request so one request queries once.
   */
  async resolveUserContext(
    authUser: AuthUser,
    request?: RequestWithUserContext,
  ): Promise<UserContext> {
    if (request?.[REQUEST_USER_CONTEXT]) {
      return request[REQUEST_USER_CONTEXT];
    }

    const user = await this.findOrProvisionUser(authUser);
    const { roles, permissions } = await this.loadRolesAndPermissions(user.id);

    const context: UserContext = {
      id: user.id,
      email: user.email,
      name: user.name,
      roles,
      permissions,
    };

    if (request) {
      request[REQUEST_USER_CONTEXT] = context;
    }
    return context;
  }

  private async findOrProvisionUser(authUser: AuthUser) {
    const existing = await this.prisma.user.findUnique({
      where: { idpSubject: authUser.idpSubject },
    });
    if (existing) {
      return existing;
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            id: randomUUID(),
            idpSubject: authUser.idpSubject,
            // `email` is NOT NULL UNIQUE; fall back to a deterministic synthetic
            // value when Keycloak omits it (email scope not requested).
            email: authUser.email?.trim() || `${authUser.idpSubject}@unknown.local`,
            name: authUser.name,
          },
        });

        const viewerRole = await tx.role.findUnique({ where: { name: 'VIEWER' } });
        if (viewerRole) {
          await tx.userRole.create({ data: { userId: user.id, roleId: viewerRole.id } });
        } else {
          this.logger.warn(
            `VIEWER role not found; provisioned user ${authUser.idpSubject} without roles. Run the seed.`,
          );
        }

        return user;
      });
    } catch (error) {
      // Two concurrent first-logins for the same sub can race on the unique
      // idp_subject constraint; re-read the winner instead of failing.
      if (this.isUniqueConstraintViolation(error)) {
        this.logger.log(`Provisioning race for ${authUser.idpSubject}; re-reading existing row.`);
        const winner = await this.prisma.user.findUnique({
          where: { idpSubject: authUser.idpSubject },
        });
        if (winner) {
          return winner;
        }
      }
      throw error;
    }
  }

  private async loadRolesAndPermissions(
    userId: string,
  ): Promise<{ roles: string[]; permissions: string[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    const roles = new Set<string>();
    const permissions = new Set<string>();

    for (const userRole of user?.userRoles ?? []) {
      if (!userRole.role) {
        continue;
      }
      roles.add(userRole.role.name);
      for (const rolePermission of userRole.role.rolePermissions ?? []) {
        if (rolePermission.permission) {
          permissions.add(rolePermission.permission.name);
        }
      }
    }

    return { roles: [...roles].sort(), permissions: [...permissions].sort() };
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
