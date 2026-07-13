
CREATE OR REPLACE FUNCTION public.__verify_content_title_pub_guard(
  p_creator_a uuid,
  p_creator_b uuid,
  p_admin uuid,
  p_workspace_a uuid,
  p_workspace_b uuid,
  p_title_a uuid,
  p_title_b uuid
) RETURNS TABLE(test text, outcome text, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE n int; ok boolean;
BEGIN
  IF NOT (public.is_super_admin(auth.uid()) OR has_role(auth.uid(),'admin'::app_role)) THEN
    RAISE EXCEPTION 'not_authorized_to_run_verifier';
  END IF;

  INSERT INTO public.workspace_members(workspace_id,user_id,role)
    VALUES (p_workspace_a,p_creator_a,'admin')
    ON CONFLICT (workspace_id,user_id) DO UPDATE SET role='admin';

  PERFORM set_config('request.jwt.claims',json_build_object('sub',p_admin::text,'role','authenticated')::text,true);
  UPDATE public.content_titles SET
    status='draft', approved_at=NULL, approved_by=NULL,
    published_at=NULL, published_by=NULL, submitted_at=NULL, locked=false
  WHERE id=p_title_a;

  -- 1
  PERFORM set_config('request.jwt.claims',json_build_object('sub',p_creator_a::text,'role','authenticated')::text,true);
  BEGIN UPDATE public.content_titles SET title=title WHERE id=p_title_b;
    RETURN QUERY SELECT 'creator_A_edits_B_title','FAIL','not denied';
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'creator_A_edits_B_title','PASS',SQLERRM; END;

  -- 2
  BEGIN UPDATE public.content_titles SET status='published' WHERE id=p_title_a;
    RETURN QUERY SELECT 'creator_draft_to_published','FAIL','not denied';
  EXCEPTION WHEN OTHERS THEN RETURN QUERY SELECT 'creator_draft_to_published','PASS',SQLERRM; END;

  -- 3
  BEGIN UPDATE public.content_titles SET published_by=p_creator_a WHERE id=p_title_a;
    RETURN QUERY SELECT 'creator_writes_published_by','FAIL','not denied';
  EXCEPTION WHEN OTHERS THEN RETURN QUERY SELECT 'creator_writes_published_by','PASS',SQLERRM; END;

  -- 4
  BEGIN UPDATE public.content_titles SET owner_user_id=p_creator_b WHERE id=p_title_a;
    RETURN QUERY SELECT 'creator_reassign_owner','FAIL','not denied';
  EXCEPTION WHEN OTHERS THEN RETURN QUERY SELECT 'creator_reassign_owner','PASS',SQLERRM; END;

  -- 5
  BEGIN UPDATE public.content_titles SET workspace_id=p_workspace_b WHERE id=p_title_a;
    RETURN QUERY SELECT 'creator_change_workspace','FAIL','not denied';
  EXCEPTION WHEN OTHERS THEN RETURN QUERY SELECT 'creator_change_workspace','PASS',SQLERRM; END;

  -- 6
  PERFORM set_config('request.jwt.claims',json_build_object('sub',p_admin::text,'role','authenticated')::text,true);
  BEGIN UPDATE public.content_titles SET status='published' WHERE id=p_title_a;
    RETURN QUERY SELECT 'admin_draft_to_published','FAIL','not denied';
  EXCEPTION WHEN OTHERS THEN RETURN QUERY SELECT 'admin_draft_to_published','PASS',SQLERRM; END;

  PERFORM set_config('request.jwt.claims',json_build_object('sub',p_creator_a::text,'role','authenticated')::text,true);
  BEGIN UPDATE public.content_titles SET status='submitted' WHERE id=p_title_a;
    RETURN QUERY SELECT 'creator_submit','PASS','allowed';
  EXCEPTION WHEN OTHERS THEN RETURN QUERY SELECT 'creator_submit','FAIL',SQLERRM; RETURN; END;

  -- 7
  PERFORM set_config('request.jwt.claims',json_build_object('sub',p_admin::text,'role','authenticated')::text,true);
  BEGIN UPDATE public.content_titles SET status='published' WHERE id=p_title_a;
    RETURN QUERY SELECT 'admin_submitted_to_published','FAIL','not denied';
  EXCEPTION WHEN OTHERS THEN RETURN QUERY SELECT 'admin_submitted_to_published','PASS',SQLERRM; END;

  -- 8
  BEGIN UPDATE public.content_titles SET status='changes_requested' WHERE id=p_title_a;
    RETURN QUERY SELECT 'admin_submitted_to_changes_requested','PASS','allowed';
  EXCEPTION WHEN OTHERS THEN RETURN QUERY SELECT 'admin_submitted_to_changes_requested','FAIL',SQLERRM; END;

  -- 9
  BEGIN UPDATE public.content_titles SET status='published' WHERE id=p_title_a;
    RETURN QUERY SELECT 'admin_cr_to_published','FAIL','not denied';
  EXCEPTION WHEN OTHERS THEN RETURN QUERY SELECT 'admin_cr_to_published','PASS',SQLERRM; END;

  PERFORM set_config('request.jwt.claims',json_build_object('sub',p_creator_a::text,'role','authenticated')::text,true);
  UPDATE public.content_titles SET status='submitted' WHERE id=p_title_a;

  -- 10
  PERFORM set_config('request.jwt.claims',json_build_object('sub',p_admin::text,'role','authenticated')::text,true);
  BEGIN UPDATE public.content_titles SET status='approved' WHERE id=p_title_a;
    RETURN QUERY SELECT 'admin_submitted_to_approved','PASS','allowed';
  EXCEPTION WHEN OTHERS THEN RETURN QUERY SELECT 'admin_submitted_to_approved','FAIL',SQLERRM; RETURN; END;

  -- 11
  UPDATE public.content_titles SET status='published' WHERE id=p_title_a;
  SELECT (published_by=p_admin AND published_at IS NOT NULL) INTO ok
    FROM public.content_titles WHERE id=p_title_a;
  RETURN QUERY SELECT 'admin_approved_to_published',
    CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, format('stamped=%s',ok);

  -- 12
  BEGIN UPDATE public.content_titles SET status='draft' WHERE id=p_title_a;
    RETURN QUERY SELECT 'admin_published_to_draft','FAIL','not denied';
  EXCEPTION WHEN OTHERS THEN RETURN QUERY SELECT 'admin_published_to_draft','PASS',SQLERRM; END;

  -- 13
  BEGIN UPDATE public.content_titles SET status='approved' WHERE id=p_title_a;
    RETURN QUERY SELECT 'admin_published_to_approved','PASS','withdrawal';
  EXCEPTION WHEN OTHERS THEN RETURN QUERY SELECT 'admin_published_to_approved','FAIL',SQLERRM; END;

  -- 14
  UPDATE public.content_titles SET status='rejected' WHERE id=p_title_a;
  BEGIN UPDATE public.content_titles SET status='published' WHERE id=p_title_a;
    RETURN QUERY SELECT 'admin_rejected_to_published','FAIL','not denied';
  EXCEPTION WHEN OTHERS THEN RETURN QUERY SELECT 'admin_rejected_to_published','PASS',SQLERRM; END;

  -- 15 ws admin cross workspace
  PERFORM set_config('request.jwt.claims',json_build_object('sub',p_creator_a::text,'role','authenticated')::text,true);
  BEGIN UPDATE public.content_titles SET title=title WHERE id=p_title_b;
    RETURN QUERY SELECT 'ws_admin_A_edits_B','FAIL','not denied';
  EXCEPTION WHEN OTHERS THEN RETURN QUERY SELECT 'ws_admin_A_edits_B','PASS',SQLERRM; END;

  -- 16 insert as published
  PERFORM set_config('request.jwt.claims',json_build_object('sub',p_admin::text,'role','authenticated')::text,true);
  BEGIN INSERT INTO public.content_titles(owner_user_id,workspace_id,title,status)
      VALUES (p_admin,p_workspace_a,'__pgtest_bypass','published');
    RETURN QUERY SELECT 'insert_as_published','FAIL','not denied';
  EXCEPTION WHEN OTHERS THEN RETURN QUERY SELECT 'insert_as_published','PASS',SQLERRM; END;

  -- cleanup tA
  BEGIN UPDATE public.content_titles SET status='approved' WHERE id=p_title_a;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN UPDATE public.content_titles SET status='draft', approved_at=NULL,
    approved_by=NULL, published_at=NULL, published_by=NULL, submitted_at=NULL
    WHERE id=p_title_a;
  EXCEPTION WHEN OTHERS THEN NULL; END;
END;
$fn$;
