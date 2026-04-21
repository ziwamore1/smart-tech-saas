import { Test, TestingModule } from '@nestjs/testing';
import { StudentService } from './student.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('StudentService', () => {
  let service: StudentService;
  let prisma: jest.Mocked<PrismaService>;

  const mockStudent = {
    id: 'student-1',
    firstName: 'John',
    lastName: 'Doe',
    admissionNumber: 'ADM001',
    gender: 'MALE' as const,
    dateOfBirth: new Date('2010-01-01'),
    schoolId: 'school-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrisma = {
      student: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      enrollment: {
        findFirst: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      academicYear: {
        findUnique: jest.fn(),
      },
      class: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<StudentService>(StudentService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('update', () => {
    it('should update a student successfully', async () => {
      const updateDto = { firstName: 'Jane' };
      prisma.student.findUnique.mockResolvedValue(mockStudent);
      prisma.student.update.mockResolvedValue({ ...mockStudent, ...updateDto });

      const result = await service.update('student-1', updateDto);

      expect(prisma.student.findUnique).toHaveBeenCalledWith({ where: { id: 'student-1' } });
      expect(prisma.student.update).toHaveBeenCalledWith({
        where: { id: 'student-1' },
        data: updateDto,
      });
      expect(result.firstName).toBe('Jane');
    });

    it('should throw NotFoundException when student not found', async () => {
      prisma.student.findUnique.mockResolvedValue(null);

      await expect(service.update('invalid-id', { firstName: 'Jane' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return a student with enrollments', async () => {
      const studentWithEnrollments = {
        ...mockStudent,
        enrollments: [],
      };
      prisma.student.findUnique.mockResolvedValue(studentWithEnrollments);

      const result = await service.findOne('student-1');

      expect(result).toEqual(studentWithEnrollments);
    });

    it('should throw NotFoundException when student not found', async () => {
      prisma.student.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete a student and their enrollments', async () => {
      prisma.student.findUnique.mockResolvedValue(mockStudent);
      prisma.enrollment.deleteMany.mockResolvedValue({ count: 1 });
      prisma.student.delete.mockResolvedValue(mockStudent);

      const result = await service.delete('student-1');

      expect(prisma.enrollment.deleteMany).toHaveBeenCalledWith({ where: { studentId: 'student-1' } });
      expect(prisma.student.delete).toHaveBeenCalledWith({ where: { id: 'student-1' } });
      expect(result).toEqual({ message: 'Student deleted successfully' });
    });

    it('should throw NotFoundException when student not found', async () => {
      prisma.student.findUnique.mockResolvedValue(null);

      await expect(service.delete('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });
});