import { ADMIN_ROLES, STAFF_SELF_ROLES } from './staff-records.controller';

describe('Advanced Staff Profile role access', () => {
  it('allows every seeded staff role to load and save its own profile', () => {
    expect(STAFF_SELF_ROLES).toEqual(expect.arrayContaining([
      'Director',
      'Deputy Director',
      'Head Teacher',
      'Deputy Head',
      'Deputy',
      'HOD',
      'Teacher',
      'Class Teacher',
      'Lower Primary Senior Teacher',
      'Upper Primary Senior Teacher',
    ]));
  });

  it('allows the administrative roles to use school-wide profile sync', () => {
    expect(ADMIN_ROLES).toEqual(expect.arrayContaining([
      'Director',
      'Deputy Director',
      'Head Teacher',
      'Deputy Head',
      'Deputy',
      'SuperAdmin',
    ]));
  });
});
