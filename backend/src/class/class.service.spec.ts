import { Test, TestingModule } from '@nestjs/testing';
import { ClassService } from './class.service';
import { ClassAccessService } from '../common/access/class-access.service';

describe('ClassService', () => {
  let service: ClassService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassService,
        { provide: ClassAccessService, useValue: { canAccessClasses: jest.fn(), getPermissions: jest.fn() } },
      ],
    }).compile();

    service = module.get<ClassService>(ClassService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
