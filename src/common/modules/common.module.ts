import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { SocketService } from '../services/socket.service';
import { UsersModule } from '../../users/users.module';

@Global()
@Module({
  imports: [
    // JWT Configuration
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>('JWT_SECRET') || 'fallback-secret-key',
        signOptions: {
          expiresIn: configService.get<number>('JWT_EXPIRES_IN') || '24h',
        },
      }),
    }),

    // Users Module (for UsersService)
    UsersModule,

    // Config Module
    ConfigModule,
  ],
  providers: [
    SocketService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService): Redis => {
        const redis = new Redis({
          host: configService.get<string>('REDIS_HOST') || 'localhost',
          port: configService.get<number>('REDIS_PORT') || 6379,
          password: configService.get<string>('REDIS_PASSWORD'),
        });

        // Add connection logging
        redis.on('connect', () => {
          console.log('🔌 Redis connecting...');
        });

        redis.on('ready', () => {
          console.log('✅ Redis connected successfully');
        });

        redis.on('error', (error) => {
          console.log('❌ Redis connection error:', error.message);
        });

        return redis;
      },
      inject: [ConfigService],
    },
  ],
  exports: [SocketService, JwtModule, 'REDIS_CLIENT'],
})
export class CommonModule {}
