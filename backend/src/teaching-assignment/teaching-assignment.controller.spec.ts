import { Test, TestingModule } from '@nestjs/testing';
import { TeachingAssignmentController } from './teaching-assignment.controller';

describe('TeachingAssignmentController', () => {
  let controller: TeachingAssignmentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TeachingAssignmentController],
    }).compile();

    controller = module.get<TeachingAssignmentController>(
      TeachingAssignmentController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
