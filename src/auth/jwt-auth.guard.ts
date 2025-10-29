import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AuthenticatedUser } from '../common/interfaces/auth.interface';

interface AuthInfo {
  message?: string;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<TUser = AuthenticatedUser>(
    err: any,
    user: TUser,
    info: AuthInfo,
    context: ExecutionContext,
  ): TUser {
    let errorMessage = 'Authentication failed';

    if (
      info &&
      typeof info === 'object' &&
      'message' in info &&
      typeof info.message === 'string'
    ) {
      errorMessage = info.message;
    }

    if (err || !user) {
      throw new UnauthorizedException(errorMessage);
    }

    const request = context.switchToHttp().getRequest<{ user: TUser }>();
    request.user = user;

    return user;
  }
}
