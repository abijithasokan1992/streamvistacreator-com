-- ============================================================================
-- College ERP Security Policies & Row-Level Security (VPD)
-- Phase 5 - Security (OCI IAM, APEX Authentication & Multi-Tenant VPD)
-- ============================================================================

-- 1. Create a Global Application Context for ERP session parameters
-- Note: Must be executed by a user with CREATE ANY CONTEXT privilege
-- CREATE OR REPLACE CONTEXT erp_context USING pkg_erp_session;

-- 2. Session Management Package to Set Context on Login
CREATE OR REPLACE PACKAGE pkg_erp_session IS
    PROCEDURE set_session_context(
        p_user_id    IN NUMBER,
        p_college_id IN NUMBER,
        p_role_name  IN VARCHAR2
    );
    
    PROCEDURE clear_session_context;
END pkg_erp_session;
/

CREATE OR REPLACE PACKAGE BODY pkg_erp_session IS
    PROCEDURE set_session_context(
        p_user_id    IN NUMBER,
        p_college_id IN NUMBER,
        p_role_name  IN VARCHAR2
    ) IS
    BEGIN
        DBMS_SESSION.SET_CONTEXT('erp_context', 'user_id', TO_CHAR(p_user_id));
        DBMS_SESSION.SET_CONTEXT('erp_context', 'college_id', TO_CHAR(p_college_id));
        DBMS_SESSION.SET_CONTEXT('erp_context', 'role_name', p_role_name);
    END set_session_context;

    PROCEDURE clear_session_context IS
    BEGIN
        DBMS_SESSION.CLEAR_CONTEXT('erp_context', NULL, 'user_id');
        DBMS_SESSION.CLEAR_CONTEXT('erp_context', NULL, 'college_id');
        DBMS_SESSION.CLEAR_CONTEXT('erp_context', NULL, 'role_name');
    END clear_session_context;
END pkg_erp_session;
/

-- 3. APEX Custom Authentication Function
-- This function is registered in APEX Shared Components -> Authentication Schemes
CREATE OR REPLACE FUNCTION fn_apex_authenticate(
    p_username IN VARCHAR2,
    p_password IN VARCHAR2
) RETURN BOOLEAN IS
    v_password_hash VARCHAR2(255);
    v_user_id       NUMBER;
    v_college_id    NUMBER;
    v_role_name     VARCHAR2(50);
    v_status        VARCHAR2(20);
BEGIN
    -- Retrieve credentials and college workspace scope
    SELECT u.id, u.college_id, u.password_hash, r.name, u.status
    INTO v_user_id, v_college_id, v_password_hash, v_role_name, v_status
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE LOWER(u.email) = LOWER(p_username);

    -- Ensure account is active
    IF v_status != 'ACTIVE' THEN
        RETURN FALSE;
    END IF;

    -- Standard Password verification using APEX native crypto package (or custom hashing)
    -- In production APEX, bcrypt/SHA-256 with salts is implemented:
    IF APEX_UTIL.DECRYPT__HASH(p_password, v_password_hash) THEN
        -- Set session context immediately upon success
        pkg_erp_session.set_session_context(v_user_id, v_college_id, v_role_name);
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RETURN FALSE;
    WHEN OTHERS THEN
        -- In case of failure, always fail closed
        RETURN FALSE;
END fn_apex_authenticate;
/

-- 4. Multi-Tenant Row-Level Security (Virtual Private Database / VPD)
-- Ensures that colleges cannot view or modify data of another college in a shared SaaS model.
CREATE OR REPLACE PACKAGE pkg_erp_security_policy IS
    -- VPD Predicate Generator Function
    FUNCTION get_college_tenant_predicate(
        p_schema IN VARCHAR2,
        p_table  IN VARCHAR2
    ) RETURN VARCHAR2;
END pkg_erp_security_policy;
/

CREATE OR REPLACE PACKAGE BODY pkg_erp_security_policy IS
    FUNCTION get_college_tenant_predicate(
        p_schema IN VARCHAR2,
        p_table  IN VARCHAR2
    ) RETURN VARCHAR2 IS
        v_college_id VARCHAR2(10);
        v_role_name  VARCHAR2(50);
    BEGIN
        -- Retrieve active session parameters from APP CONTEXT
        v_college_id := SYS_CONTEXT('erp_context', 'college_id');
        v_role_name  := SYS_CONTEXT('erp_context', 'role_name');
        
        -- Super Admin role bypasses college tenant isolation (for global maintenance and operations)
        IF v_role_name = 'Super Admin' THEN
            RETURN '1=1'; -- No filtering applied
        END IF;

        -- If a valid tenant session is found, apply tenant boundary filter
        IF v_college_id IS NOT NULL THEN
            RETURN 'college_id = ' || TO_NUMBER(v_college_id);
        ELSE
            -- No active college context found (fail-secure: block all records)
            RETURN '1=0';
        END IF;
    END get_college_tenant_predicate;
END pkg_erp_security_policy;
/

-- 5. Applying DBMS_RLS Policies to Core Tables
-- Execute this block to register VPD policies on multi-tenant tables.
BEGIN
    -- Apply policy to Users table
    DBMS_RLS.ADD_POLICY(
        object_schema     => USER,
        object_name       => 'users',
        policy_name       => 'pls_tenant_users',
        function_schema   => USER,
        policy_function   => 'pkg_erp_security_policy.get_college_tenant_predicate',
        statement_types   => 'SELECT, INSERT, UPDATE, DELETE',
        update_check      => TRUE,
        enable            => TRUE
    );

    -- Apply policy to Students table
    DBMS_RLS.ADD_POLICY(
        object_schema     => USER,
        object_name       => 'students',
        policy_name       => 'pls_tenant_students',
        function_schema   => USER,
        policy_function   => 'pkg_erp_security_policy.get_college_tenant_predicate',
        statement_types   => 'SELECT, INSERT, UPDATE, DELETE',
        update_check      => TRUE,
        enable            => TRUE
    );

    -- Apply policy to Faculty table
    DBMS_RLS.ADD_POLICY(
        object_schema     => USER,
        object_name       => 'faculty',
        policy_name       => 'pls_tenant_faculty',
        function_schema   => USER,
        policy_function   => 'pkg_erp_security_policy.get_college_tenant_predicate',
        statement_types   => 'SELECT, INSERT, UPDATE, DELETE',
        update_check      => TRUE,
        enable            => TRUE
    );

    -- Apply policy to Fee Structure table
    DBMS_RLS.ADD_POLICY(
        object_schema     => USER,
        object_name       => 'fee_structure',
        policy_name       => 'pls_tenant_fees',
        function_schema   => USER,
        policy_function   => 'pkg_erp_security_policy.get_college_tenant_predicate',
        statement_types   => 'SELECT, INSERT, UPDATE, DELETE',
        update_check      => TRUE,
        enable            => TRUE
    );
END;
/

-- 6. APEX Role-Based Authorization Helpers
-- Used within APEX -> Shared Components -> Authorization Schemes
CREATE OR REPLACE PACKAGE pkg_erp_auth IS
    FUNCTION is_authorized(
        p_required_roles IN VARCHAR2 -- Comma-separated roles (e.g. "Super Admin, College Admin, Accountant")
    ) RETURN BOOLEAN;
END pkg_erp_auth;
/

CREATE OR REPLACE PACKAGE BODY pkg_erp_auth IS
    FUNCTION is_authorized(
        p_required_roles IN VARCHAR2
    ) RETURN BOOLEAN IS
        v_role_name  VARCHAR2(50);
        v_authorized NUMBER := 0;
    BEGIN
        v_role_name := SYS_CONTEXT('erp_context', 'role_name');
        
        IF v_role_name IS NULL THEN
            RETURN FALSE;
        END IF;

        -- Check if the current context role name is in the list of allowed roles
        SELECT COUNT(1)
        INTO v_authorized
        FROM TABLE(apex_string.split(p_required_roles, ','))
        WHERE TRIM(column_value) = v_role_name;

        RETURN (v_authorized > 0);
    END is_authorized;
END pkg_erp_auth;
/
