-- ============================================================================
-- College ERP Seed Data Script (Oracle Database Testing Environment)
-- ============================================================================

-- Disable triggers temporarily if needed or just insert in correct dependency order
-- (We use the standard Oracle date formats: 'DD-MON-YYYY' or Oracle-native DATE castings)

-- 1. Seed Colleges (Tenants)
INSERT INTO colleges (name, domain, address, contact_phone, contact_email) 
VALUES ('Apex University', 'apexuniv.edu', '100 Innovation Way, Cloud City, OCI', '+1-555-0199', 'info@apexuniv.edu');

INSERT INTO colleges (name, domain, address, contact_phone, contact_email) 
VALUES ('OCI Institute of Technology', 'oci-tech.edu', '500 Autonomous Parkway, Oracle Valley, CA', '+1-555-0244', 'contact@oci-tech.edu');

-- 2. Seed Roles
INSERT INTO roles (name, description) VALUES ('Super Admin', 'Platform global owner with access to multi-tenant monitoring and systems setup');
INSERT INTO roles (name, description) VALUES ('College Admin', 'College Principal / Director managing workspace configurations and personnel roster');
INSERT INTO roles (name, description) VALUES ('Admission Officer', 'Handles student enrollment applications validation, verification, and onboarding');
INSERT INTO roles (name, description) VALUES ('Faculty', 'Teaching professors managing attendance, timetables, courses, and exam marks upload');
INSERT INTO roles (name, description) VALUES ('Student', 'Registered students accessing courses, schedules, marksheets, library books, and fee ledgers');
INSERT INTO roles (name, description) VALUES ('Parent', 'Parents monitoring student progress, attendance reports, and making fee payments online');
INSERT INTO roles (name, description) VALUES ('Accountant', 'Financial operations console administrator managing tuition dues collections and ledger approvals');
INSERT INTO roles (name, description) VALUES ('Librarian', 'Book catalog manager supervising checkouts, returns, and library operations');
INSERT INTO roles (name, description) VALUES ('Placement Officer', 'Supervises corporate hiring drives, student resume books, and internship postings');

-- 3. Seed Departments (Apex University - ID 1, OCI Tech - ID 2)
INSERT INTO departments (college_id, name, code) VALUES (1, 'Computer Science & Engineering', 'CSE');
INSERT INTO departments (college_id, name, code) VALUES (1, 'Mechanical Engineering', 'MECH');
INSERT INTO departments (college_id, name, code) VALUES (2, 'Information Technology', 'IT');
INSERT INTO departments (college_id, name, code) VALUES (2, 'Business Administration', 'BBA');

-- 4. Seed Courses
INSERT INTO courses (college_id, department_id, name, code, credits) VALUES (1, 1, 'Database Management Systems', 'CSE-301', 4);
INSERT INTO courses (college_id, department_id, name, code, credits) VALUES (1, 1, 'Data Structures & Algorithms', 'CSE-102', 4);
INSERT INTO courses (college_id, department_id, name, code, credits) VALUES (1, 2, 'Thermodynamics', 'MECH-201', 3);
INSERT INTO courses (college_id, department_id, name, code, credits) VALUES (2, 3, 'Cloud Infrastructure Architecture', 'IT-402', 4);
INSERT INTO courses (college_id, department_id, name, code, credits) VALUES (2, 4, 'Financial Accounting', 'BBA-101', 3);

-- 5. Seed Academic Years
INSERT INTO academic_years (college_id, name, start_date, end_date, is_active) 
VALUES (1, 'AY 2025-26', TO_DATE('2025-06-01', 'YYYY-MM-DD'), TO_DATE('2026-04-30', 'YYYY-MM-DD'), 'N');

INSERT INTO academic_years (college_id, name, start_date, end_date, is_active) 
VALUES (1, 'AY 2026-27', TO_DATE('2026-06-01', 'YYYY-MM-DD'), TO_DATE('2027-04-30', 'YYYY-MM-DD'), 'Y');

INSERT INTO academic_years (college_id, name, start_date, end_date, is_active) 
VALUES (2, 'AY 2026-27', TO_DATE('2026-06-01', 'YYYY-MM-DD'), TO_DATE('2027-04-30', 'YYYY-MM-DD'), 'Y');

-- 6. Seed Users
-- Passwords represented as standard test hashes (or mock hashes)
-- Users for Apex University (College ID 1)
INSERT INTO users (college_id, role_id, email, password_hash, first_name, last_name, status)
VALUES (1, 2, 'admin@apexuniv.edu', '$2b$10$xyz', 'Dr. Albert', 'Einstein', 'ACTIVE'); -- Admin

INSERT INTO users (college_id, role_id, email, password_hash, first_name, last_name, status)
VALUES (1, 4, 'richard.feynman@apexuniv.edu', '$2b$10$xyz', 'Richard', 'Feynman', 'ACTIVE'); -- Faculty

INSERT INTO users (college_id, role_id, email, password_hash, first_name, last_name, status)
VALUES (1, 5, 'student1@apexuniv.edu', '$2b$10$xyz', 'Marie', 'Curie', 'ACTIVE'); -- Student

INSERT INTO users (college_id, role_id, email, password_hash, first_name, last_name, status)
VALUES (1, 7, 'accountant@apexuniv.edu', '$2b$10$xyz', 'Warren', 'Buffett', 'ACTIVE'); -- Accountant

INSERT INTO users (college_id, role_id, email, password_hash, first_name, last_name, status)
VALUES (1, 8, 'librarian@apexuniv.edu', '$2b$10$xyz', 'Melvil', 'Dewey', 'ACTIVE'); -- Librarian

-- Users for OCI Tech (College ID 2)
INSERT INTO users (college_id, role_id, email, password_hash, first_name, last_name, status)
VALUES (2, 4, 'grace.hopper@oci-tech.edu', '$2b$10$xyz', 'Grace', 'Hopper', 'ACTIVE'); -- Faculty

INSERT INTO users (college_id, role_id, email, password_hash, first_name, last_name, status)
VALUES (2, 5, 'student2@oci-tech.edu', '$2b$10$xyz', 'Alan', 'Turing', 'ACTIVE'); -- Student

-- 7. Seed Student Profiles (Referencing user tables)
-- Marie Curie (User ID 3) enrolled in Apex University (CSE-102)
INSERT INTO students (user_id, college_id, department_id, course_id, academic_year_id, admission_number, roll_number, date_of_birth, phone_number, photo_url)
VALUES (3, 1, 1, 1, 2, 'ADM-2026-0001', 'ROLL-CSE-101', TO_DATE('2004-11-07', 'YYYY-MM-DD'), '+1-555-0391', 'https://objectstorage.us-ashburn-1.oraclecloud.com/n/tenancy/b/erp-student-photos/o/student_3.jpg');

-- Alan Turing (User ID 7) enrolled in OCI Tech (IT-402)
INSERT INTO students (user_id, college_id, department_id, course_id, academic_year_id, admission_number, roll_number, date_of_birth, phone_number, photo_url)
VALUES (7, 2, 3, 4, 3, 'ADM-2026-0002', 'ROLL-IT-401', TO_DATE('2004-06-23', 'YYYY-MM-DD'), '+1-555-0812', 'https://objectstorage.us-ashburn-1.oraclecloud.com/n/tenancy/b/erp-student-photos/o/student_7.jpg');

-- 8. Seed Faculty Profiles
-- Richard Feynman (User ID 2) teaching at Apex Univ CSE
INSERT INTO faculty (user_id, college_id, department_id, designation, qualification, phone_number)
VALUES (2, 1, 1, 'Professor & Chair', 'Ph.D. in Quantum Electrodynamics', '+1-555-0455');

-- Grace Hopper (User ID 6) teaching at OCI Tech IT
INSERT INTO faculty (user_id, college_id, department_id, designation, qualification, phone_number)
VALUES (6, 2, 3, 'Associate Professor', 'Ph.D. in Mathematics & Computation', '+1-555-0902');

-- 9. Seed Admissions (Applicants and reviewers)
INSERT INTO admissions (college_id, first_name, last_name, email, phone, course_id, status, submitted_at, reviewed_by, remarks)
VALUES (1, 'Nikola', 'Tesla', 'nikola@electricity.com', '+1-555-0101', 2, 'APPROVED', SYSTIMESTAMP, 1, 'Outstanding application profile. Cleared verification.');

INSERT INTO admissions (college_id, first_name, last_name, email, phone, course_id, status, submitted_at, reviewed_by, remarks)
VALUES (1, 'Ada', 'Lovelace', 'ada@programming.org', '+1-555-1815', 1, 'PENDING', SYSTIMESTAMP, NULL, NULL);

-- 10. Seed Timetable Sessions
-- Day 1 = Monday. Class hours: 09:00 - 09:50
INSERT INTO timetable (college_id, department_id, course_id, faculty_id, academic_year_id, day_of_week, start_time, end_time, classroom)
VALUES (1, 1, 1, 1, 2, 1, '09:00', '09:50', 'Room 101 - CS Block');

INSERT INTO timetable (college_id, department_id, course_id, faculty_id, academic_year_id, day_of_week, start_time, end_time, classroom)
VALUES (1, 1, 2, 1, 2, 1, '10:00', '10:50', 'Room 102 - CS Block');

-- 11. Seed Attendance Entries
-- Absent on first day, present on second
INSERT INTO attendance (student_id, course_id, faculty_id, attendance_date, status, remarks)
VALUES (1, 1, 1, TO_DATE('2026-06-15', 'YYYY-MM-DD'), 'A', 'Unexcused leave');

INSERT INTO attendance (student_id, course_id, faculty_id, attendance_date, status, remarks)
VALUES (1, 1, 1, TO_DATE('2026-06-16', 'YYYY-MM-DD'), 'P', 'Arrived on time');

-- 12. Seed Exams
INSERT INTO exams (college_id, course_id, academic_year_id, name, exam_date, max_marks, min_marks)
VALUES (1, 1, 2, 'Midterm Examination 2026', TO_DATE('2026-10-12', 'YYYY-MM-DD'), 100.00, 40.00);

-- 13. Seed Marks
-- Auto-grade calculation trigger will compute Grade automatically (e.g. 95 obtains A+)
INSERT INTO marks (exam_id, student_id, marks_obtained, remarks)
VALUES (1, 1, 95.50, 'Excellent performance in structural querying modules.');

-- 14. Seed Fee Structures
INSERT INTO fee_structure (college_id, course_id, academic_year_id, fee_type, amount, due_date)
VALUES (1, 1, 2, 'Tuition Fee - CSE', 5000.00, TO_DATE('2026-08-31', 'YYYY-MM-DD'));

INSERT INTO fee_structure (college_id, course_id, academic_year_id, fee_type, amount, due_date)
VALUES (1, 1, 2, 'Library Fee', 250.00, TO_DATE('2026-08-31', 'YYYY-MM-DD'));

-- 15. Seed Fee Payments
INSERT INTO fee_payments (student_id, fee_structure_id, amount_paid, payment_date, payment_method, transaction_id, status)
VALUES (1, 1, 5000.00, SYSTIMESTAMP, 'Razorpay', 'pay_RAZORPAY_123456789', 'COMPLETED');

-- 16. Seed Library Books Catalog
INSERT INTO library_books (college_id, title, author, isbn, quantity, available)
VALUES (1, 'Database System Concepts (7th Edition)', 'Avi Silberschatz', '978-0078022135', 10, 10);

INSERT INTO library_books (college_id, title, author, isbn, quantity, available)
VALUES (1, 'Introduction to Algorithms (4th Edition)', 'Thomas Cormen', '978-0262046305', 5, 5);

-- 17. Seed Book Issues
-- Triggers will automatically deduct book stock availability when status is ISSUED
INSERT INTO book_issues (book_id, user_id, issue_date, due_date, return_date, fine_amount, status)
VALUES (1, 3, TO_DATE('2026-06-15', 'YYYY-MM-DD'), TO_DATE('2026-06-30', 'YYYY-MM-DD'), NULL, 0.00, 'ISSUED');

-- 18. Seed Hostel Rooms
INSERT INTO hostel_rooms (college_id, block_name, room_number, capacity, occupied, status)
VALUES (1, 'Newton Hostel Boys Block A', 'RM-101', 2, 1, 'AVAILABLE');

-- 19. Seed Transport Routes
INSERT INTO transport_routes (college_id, route_name, driver_name, driver_phone, vehicle_number)
VALUES (1, 'Route 9A - Downtown To Campus Express', 'John Doe', '+1-555-0810', 'CA-AUTON-882');

-- 20. Seed Notifications
INSERT INTO notifications (college_id, sender_id, recipient_id, title, message)
VALUES (1, 1, 3, 'Welcome to the Autonomous APEX ERP!', 'Your student enrollment has been completed. Log in using your assigned credentials.');

-- 21. Seed Documents (Metadata records linked to OCI Object Storage bucket objects)
INSERT INTO documents (college_id, uploader_id, entity_type, entity_id, file_name, file_size, file_type, oci_object_name)
VALUES (1, 1, 'STUDENT', 1, 'marie_curie_id_card.pdf', 1048576, 'application/pdf', 'tenancy/apexuniv/docs/marie_curie_id_card.pdf');

-- 22. Seed Initial Audit Logs
INSERT INTO audit_logs (college_id, user_id, action, table_name, record_id, old_values, new_values, ip_address)
VALUES (1, 1, 'CREATE STUDENT', 'students', 1, NULL, '{"admission_number": "ADM-2026-0001", "name": "Marie Curie"}', '127.0.0.1');

COMMIT;
