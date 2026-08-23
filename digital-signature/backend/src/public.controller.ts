import { Controller, Get, Param } from '@nestjs/common';
import { SignaturesService } from './signatures/signatures.service';

/**
 * Public, unauthenticated verification endpoint.
 * Third parties can confirm a signature without an account.
 */
@Controller('public')
export class PublicController {
  constructor(private signatures: SignaturesService) {}

  @Get('verify/:idOrHash')
  verify(@Param('idOrHash') idOrHash: string) {
    return this.signatures.verify(idOrHash);
  }
}
