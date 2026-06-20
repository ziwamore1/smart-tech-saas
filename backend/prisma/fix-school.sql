-- First, find the demo school and its subjects
SELECT id, name FROM "School" WHERE name = 'Demo International School';

-- Find subjects created under the demo school
SELECT s.id, s.name, s.code, s."schoolId" FROM "Subject" s
WHERE s."schoolId" = (SELECT id FROM "School" WHERE name = 'Demo International School' LIMIT 1);

-- Find subjects under the real school (SMART TECH SECONDARY)
SELECT s.id, s.name, s.code, s."schoolId" FROM "Subject" s
WHERE s."schoolId" = '3d439fb7-1d33-4291-b150-7dea9935042c';
