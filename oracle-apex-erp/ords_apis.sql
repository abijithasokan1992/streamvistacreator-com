-- ============================================================================
-- College ERP REST APIs (ORDS - Oracle REST Data Services Configuration)
-- Phase 7 - REST APIs
-- ============================================================================

-- Enable ORDS Schema
-- (This must be run first by the schema owner to register it with the web gateway)
-- BEGIN
--     ORDS.enable_schema(
--         p_enabled             => TRUE,
--         p_schema              => USER,
--         p_url_mapping_type    => 'BASE_PATH',
--         p_url_mapping_pattern => 'college-erp',
--         p_auto_rest_auth      => FALSE
--     );
--     COMMIT;
-- END;
-- /

-- Define ORDS REST Module & Templates
DECLARE
    PRAGMA AUTONOMOUS_TRANSACTION;
BEGIN
    -- Delete existing module if it exists
    ORDS.delete_module(p_module_name => 'college.erp.api');

    -- Create ERP Module
    ORDS.define_module(
        p_module_name    => 'college.erp.api',
        p_base_path      => 'erp/',
        p_items_per_page => 25,
        p_status         => 'PUBLISHED',
        p_comments       => 'Core ORDS REST API Module for OCI College ERP Integration'
    );

    -- ==========================================
    -- 1. Student Module Templates & Handlers
    -- ==========================================
    ORDS.define_template(
        p_module_name => 'college.erp.api',
        p_pattern     => 'students/:admission_number',
        p_comments    => 'Get details for a specific student'
    );

    ORDS.define_handler(
        p_module_name => 'college.erp.api',
        p_pattern     => 'students/:admission_number',
        p_method      => 'GET',
        p_source_type => ORDS.source_type_collection_feed,
        p_source      => 'SELECT s.id, u.first_name, u.last_name, u.email, s.admission_number, s.roll_number,
                             d.name as department_name, c.name as course_name, ay.name as academic_year,
                             s.phone_number, s.photo_url
                      FROM students s
                      JOIN users u ON s.user_id = u.id
                      JOIN departments d ON s.department_id = d.id
                      JOIN courses c ON s.course_id = c.id
                      JOIN academic_years ay ON s.academic_year_id = ay.id
                      WHERE s.admission_number = :admission_number',
        p_comments    => 'Fetch student demographic and enrollment parameters'
    );

    -- ==========================================
    -- 2. Admissions Module Templates & Handlers
    -- ==========================================
    ORDS.define_template(
        p_module_name => 'college.erp.api',
        p_pattern     => 'admissions/',
        p_comments    => 'Process and query admissions applications'
    );

    ORDS.define_handler(
        p_module_name => 'college.erp.api',
        p_pattern     => 'admissions/',
        p_method      => 'POST',
        p_source_type => ORDS.source_type_plsql,
        p_source      => 'BEGIN
                            INSERT INTO admissions (
                                college_id, first_name, last_name, email, phone, course_id, status
                            ) VALUES (
                                :college_id, :first_name, :last_name, :email, :phone, :course_id, ''PENDING''
                            ) RETURNING id INTO :id;
                            
                            :status_code := 201; -- Created
                         EXCEPTION
                            WHEN OTHERS THEN
                                :status_code := 400; -- Bad Request
                         END;',
        p_comments    => 'Endpoint used to submit new applications from the college registration portal'
    );

    -- ==========================================
    -- 3. Fees Module Templates & Handlers
    -- ==========================================
    ORDS.define_template(
        p_module_name => 'college.erp.api',
        p_pattern     => 'fees/pending/:student_id',
        p_comments    => 'Retrieve pending fees for a student'
    );

    ORDS.define_handler(
        p_module_name => 'college.erp.api',
        p_pattern     => 'fees/pending/:student_id',
        p_method      => 'GET',
        p_source_type => ORDS.source_type_collection_feed,
        p_source      => 'SELECT fs.id as fee_structure_id, fs.fee_type, fs.amount as total_amount, fs.due_date,
                             COALESCE(SUM(fp.amount_paid), 0) as amount_paid,
                             (fs.amount - COALESCE(SUM(fp.amount_paid), 0)) as balance_due
                      FROM fee_structure fs
                      JOIN students s ON fs.course_id = s.course_id AND fs.academic_year_id = s.academic_year_id
                      LEFT JOIN fee_payments fp ON fp.fee_structure_id = fs.id AND fp.student_id = s.id AND fp.status = ''COMPLETED''
                      WHERE s.id = :student_id
                      GROUP BY fs.id, fs.fee_type, fs.amount, fs.due_date
                      HAVING fs.amount - COALESCE(SUM(fp.amount_paid), 0) > 0',
        p_comments    => 'Check active student balances before showing razorpay billing button'
    );

    -- ==========================================
    -- 4. Attendance Module Templates & Handlers
    -- ==========================================
    ORDS.define_template(
        p_module_name => 'college.erp.api',
        p_pattern     => 'attendance/',
        p_comments    => 'Register daily attendance logs'
    );

    ORDS.define_handler(
        p_module_name => 'college.erp.api',
        p_pattern     => 'attendance/',
        p_method      => 'POST',
        p_source_type => ORDS.source_type_plsql,
        p_source      => 'BEGIN
                            INSERT INTO attendance (
                                student_id, course_id, faculty_id, attendance_date, status, remarks
                            ) VALUES (
                                :student_id, :course_id, :faculty_id, TO_DATE(:attendance_date, ''YYYY-MM-DD''), :status, :remarks
                            );
                            :status_code := 201;
                         EXCEPTION
                            WHEN DUP_VAL_ON_INDEX THEN
                                UPDATE attendance
                                SET status = :status, remarks = :remarks, faculty_id = :faculty_id
                                WHERE student_id = :student_id 
                                  AND course_id = :course_id 
                                  AND attendance_date = TO_DATE(:attendance_date, ''YYYY-MM-DD'');
                                :status_code := 200; -- Updated OK
                            WHEN OTHERS THEN
                                :status_code := 400;
                         END;',
        p_comments    => 'Submit or overwrite daily attendance sheets'
    );

    -- ==========================================
    -- 5. Results/Marks Module Templates & Handlers
    -- ==========================================
    ORDS.define_template(
        p_module_name => 'college.erp.api',
        p_pattern     => 'results/:student_id',
        p_comments    => 'Get grading records'
    );

    ORDS.define_handler(
        p_module_name => 'college.erp.api',
        p_pattern     => 'results/:student_id',
        p_method      => 'GET',
        p_source_type => ORDS.source_type_collection_feed,
        p_source      => 'SELECT ex.name as exam_name, c.name as course_name, ex.max_marks, ex.min_marks, 
                             m.marks_obtained, m.grade, m.remarks
                      FROM marks m
                      JOIN exams ex ON m.exam_id = ex.id
                      JOIN courses c ON ex.course_id = c.id
                      WHERE m.student_id = :student_id',
        p_comments    => 'Fetch semester grade cards'
    );

    -- ==========================================
    -- 6. Notifications Module Templates & Handlers
    -- ==========================================
    ORDS.define_template(
        p_module_name => 'college.erp.api',
        p_pattern     => 'notifications/',
        p_comments    => 'Broadcast and send alerts'
    );

    ORDS.define_handler(
        p_module_name => 'college.erp.api',
        p_pattern     => 'notifications/',
        p_method      => 'POST',
        p_source_type => ORDS.source_type_plsql,
        p_source      => 'BEGIN
                            INSERT INTO notifications (
                                college_id, sender_id, recipient_id, title, message
                            ) VALUES (
                                :college_id, :sender_id, :recipient_id, :title, :message
                            ) RETURNING id INTO :id;
                            
                            :status_code := 201;
                         EXCEPTION
                            WHEN OTHERS THEN
                                :status_code := 400;
                         END;',
        p_comments    => 'Push administrative broadcasts or user-specific alerts'
    );

    COMMIT;
END;
/
