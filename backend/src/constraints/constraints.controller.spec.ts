import { Test, TestingModule } from '@nestjs/testing';
import { ConstraintsController } from './constraints.controller';

describe('ConstraintsController', () => {
  let controller: ConstraintsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConstraintsController],
    }).compile();

    controller = module.get<ConstraintsController>(ConstraintsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
