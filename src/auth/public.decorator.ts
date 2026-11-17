import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/** Every route requires a valid access token unless it is marked @Public(). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
