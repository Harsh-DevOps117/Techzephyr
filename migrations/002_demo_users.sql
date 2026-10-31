INSERT INTO app_user (id, email, display_name, role, department)
VALUES
  ('018f9f69-f6f2-7b01-8a2b-531e5d44e018', 'admin@cit.local', 'CIT Admin', 'admin', NULL),
  ('018f9f69-f6f2-7b2a-8a2b-531e5d44e018', 'coordinator.cse@cit.local', 'CSE Coordinator', 'department_coordinator', 'CSE'),
  ('018f9f69-f6f2-7b3b-8a2b-531e5d44e018', 'faculty.cse@cit.local', 'CSE Faculty', 'faculty', 'CSE'),
  ('018f9f69-f6f2-7b4c-8a2b-531e5d44e018', 'club@cit.local', 'Club Representative', 'club', NULL)
ON CONFLICT (id) DO NOTHING;
