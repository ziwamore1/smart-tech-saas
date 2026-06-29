import { PartialType } from '@nestjs/mapped-types';
import { CreateMockupDto } from './create-mockup.dto';

export class UpdateMockupDto extends PartialType(CreateMockupDto) {}
