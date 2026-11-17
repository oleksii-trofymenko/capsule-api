import { Global, Module } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { parseEnv } from './env.js';

export const ENV = Symbol('ENV');

@Global()
@Module({
  providers: [
    {
      provide: ENV,
      useFactory: () => {
        if (existsSync('.env')) process.loadEnvFile('.env');
        return parseEnv(process.env);
      },
    },
  ],
  exports: [ENV],
})
export class ConfigModule {}
