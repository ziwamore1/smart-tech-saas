import { Module } from '@nestjs/common';
import { LevelTypeController } from './level-type.controller';
import { LevelTypeService } from './level-type.service';

@Module({
  controllers: [LevelTypeController],
  providers: [LevelTypeService],
})
export class LevelTypeModule {}
