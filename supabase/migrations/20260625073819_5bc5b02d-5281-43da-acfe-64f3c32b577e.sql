
-- Server-side validation + normalization for entity_profiles tax & billing fields.
-- Mirrors client-side rules in src/lib/identityValidators.ts.

CREATE OR REPLACE FUNCTION public.validate_entity_profile_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_pan_re    text := '^[A-Z]{5}[0-9]{4}[A-Z]$';
  v_gstin_re  text := '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$';
  v_tan_re    text := '^[A-Z]{4}[0-9]{5}[A-Z]$';
  v_cin_re    text := '^[LUu]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$';
  v_email_re  text := '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$';
  v_pin_re    text := '^[1-9][0-9]{5}$';
BEGIN
  -- Normalize: uppercase + strip whitespace on tax identifiers
  IF NEW.pan_number IS NOT NULL THEN
    NEW.pan_number := upper(regexp_replace(NEW.pan_number, '\s+', '', 'g'));
    IF NEW.pan_number <> '' AND NEW.pan_number !~ v_pan_re THEN
      RAISE EXCEPTION 'Invalid PAN format. Expected AAAAA9999A.' USING ERRCODE = '22023';
    END IF;
    IF NEW.pan_number = '' THEN NEW.pan_number := NULL; END IF;
  END IF;

  IF NEW.gstin IS NOT NULL THEN
    NEW.gstin := upper(regexp_replace(NEW.gstin, '\s+', '', 'g'));
    IF NEW.gstin <> '' AND NEW.gstin !~ v_gstin_re THEN
      RAISE EXCEPTION 'Invalid GSTIN format.' USING ERRCODE = '22023';
    END IF;
    IF NEW.gstin = '' THEN NEW.gstin := NULL; END IF;
  END IF;

  IF NEW.tan_number IS NOT NULL THEN
    NEW.tan_number := upper(regexp_replace(NEW.tan_number, '\s+', '', 'g'));
    IF NEW.tan_number <> '' AND NEW.tan_number !~ v_tan_re THEN
      RAISE EXCEPTION 'Invalid TAN format. Expected AAAA99999A.' USING ERRCODE = '22023';
    END IF;
    IF NEW.tan_number = '' THEN NEW.tan_number := NULL; END IF;
  END IF;

  IF NEW.cin_number IS NOT NULL THEN
    NEW.cin_number := upper(regexp_replace(NEW.cin_number, '\s+', '', 'g'));
    IF NEW.cin_number <> '' AND NEW.cin_number !~ v_cin_re THEN
      RAISE EXCEPTION 'Invalid CIN format. Expected e.g. U12345MH2020PTC123456.' USING ERRCODE = '22023';
    END IF;
    IF NEW.cin_number = '' THEN NEW.cin_number := NULL; END IF;
  END IF;

  -- Cross-field: GST registration requires a valid GSTIN
  IF COALESCE(NEW.is_gst_registered, false) = true
     AND (NEW.gstin IS NULL OR NEW.gstin = '') THEN
    RAISE EXCEPTION 'GSTIN is required when GST registration is enabled.' USING ERRCODE = '22023';
  END IF;

  -- Emails: trim and validate
  IF NEW.primary_email IS NOT NULL THEN
    NEW.primary_email := btrim(NEW.primary_email);
    IF length(NEW.primary_email) > 255 THEN
      RAISE EXCEPTION 'Primary email must be under 255 characters.' USING ERRCODE = '22023';
    END IF;
    IF NEW.primary_email <> '' AND NEW.primary_email !~ v_email_re THEN
      RAISE EXCEPTION 'Invalid primary email address.' USING ERRCODE = '22023';
    END IF;
    IF NEW.primary_email = '' THEN NEW.primary_email := NULL; END IF;
  END IF;

  IF NEW.billing_email IS NOT NULL THEN
    NEW.billing_email := btrim(NEW.billing_email);
    IF length(NEW.billing_email) > 255 THEN
      RAISE EXCEPTION 'Billing email must be under 255 characters.' USING ERRCODE = '22023';
    END IF;
    IF NEW.billing_email <> '' AND NEW.billing_email !~ v_email_re THEN
      RAISE EXCEPTION 'Invalid billing email address.' USING ERRCODE = '22023';
    END IF;
    IF NEW.billing_email = '' THEN NEW.billing_email := NULL; END IF;
  END IF;

  -- Phones: normalize (allow leading +, digits only), check digit count 7-15
  IF NEW.primary_phone IS NOT NULL THEN
    NEW.primary_phone := regexp_replace(NEW.primary_phone, '[^0-9+]', '', 'g');
    -- Keep only first leading '+'
    IF position('+' in NEW.primary_phone) > 0 THEN
      NEW.primary_phone := '+' || regexp_replace(NEW.primary_phone, '[+]', '', 'g');
    END IF;
    IF NEW.primary_phone <> '' AND
       (length(regexp_replace(NEW.primary_phone, '[^0-9]', '', 'g')) < 7
        OR length(regexp_replace(NEW.primary_phone, '[^0-9]', '', 'g')) > 15) THEN
      RAISE EXCEPTION 'Primary phone must have 7-15 digits.' USING ERRCODE = '22023';
    END IF;
    IF NEW.primary_phone = '' THEN NEW.primary_phone := NULL; END IF;
  END IF;

  IF NEW.billing_phone IS NOT NULL THEN
    NEW.billing_phone := regexp_replace(NEW.billing_phone, '[^0-9+]', '', 'g');
    IF position('+' in NEW.billing_phone) > 0 THEN
      NEW.billing_phone := '+' || regexp_replace(NEW.billing_phone, '[+]', '', 'g');
    END IF;
    IF NEW.billing_phone <> '' AND
       (length(regexp_replace(NEW.billing_phone, '[^0-9]', '', 'g')) < 7
        OR length(regexp_replace(NEW.billing_phone, '[^0-9]', '', 'g')) > 15) THEN
      RAISE EXCEPTION 'Billing phone must have 7-15 digits.' USING ERRCODE = '22023';
    END IF;
    IF NEW.billing_phone = '' THEN NEW.billing_phone := NULL; END IF;
  END IF;

  IF NEW.whatsapp IS NOT NULL THEN
    NEW.whatsapp := regexp_replace(NEW.whatsapp, '[^0-9+]', '', 'g');
    IF position('+' in NEW.whatsapp) > 0 THEN
      NEW.whatsapp := '+' || regexp_replace(NEW.whatsapp, '[+]', '', 'g');
    END IF;
    IF NEW.whatsapp <> '' AND
       (length(regexp_replace(NEW.whatsapp, '[^0-9]', '', 'g')) < 7
        OR length(regexp_replace(NEW.whatsapp, '[^0-9]', '', 'g')) > 15) THEN
      RAISE EXCEPTION 'WhatsApp number must have 7-15 digits.' USING ERRCODE = '22023';
    END IF;
    IF NEW.whatsapp = '' THEN NEW.whatsapp := NULL; END IF;
  END IF;

  -- PIN codes (Indian): 6 digits, no leading zero
  IF NEW.postal_code IS NOT NULL THEN
    NEW.postal_code := regexp_replace(NEW.postal_code, '\s+', '', 'g');
    IF NEW.postal_code <> '' AND upper(coalesce(NEW.country, 'India')) IN ('INDIA','IN','BHARAT')
       AND NEW.postal_code !~ v_pin_re THEN
      RAISE EXCEPTION 'Indian PIN code must be 6 digits and not start with 0.' USING ERRCODE = '22023';
    END IF;
    IF NEW.postal_code = '' THEN NEW.postal_code := NULL; END IF;
  END IF;

  IF NEW.billing_postal_code IS NOT NULL THEN
    NEW.billing_postal_code := regexp_replace(NEW.billing_postal_code, '\s+', '', 'g');
    IF NEW.billing_postal_code <> '' AND upper(coalesce(NEW.billing_country, NEW.country, 'India')) IN ('INDIA','IN','BHARAT')
       AND NEW.billing_postal_code !~ v_pin_re THEN
      RAISE EXCEPTION 'Indian billing PIN code must be 6 digits and not start with 0.' USING ERRCODE = '22023';
    END IF;
    IF NEW.billing_postal_code = '' THEN NEW.billing_postal_code := NULL; END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_entity_profile_identity ON public.entity_profiles;
CREATE TRIGGER trg_validate_entity_profile_identity
BEFORE INSERT OR UPDATE ON public.entity_profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_entity_profile_identity();

-- Validate primary contact email/phone on the studio extension table.
CREATE OR REPLACE FUNCTION public.validate_entity_profile_studio_ext()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_email_re text := '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$';
BEGIN
  IF NEW.primary_contact_email IS NOT NULL THEN
    NEW.primary_contact_email := btrim(NEW.primary_contact_email);
    IF length(NEW.primary_contact_email) > 255 THEN
      RAISE EXCEPTION 'Studio contact email must be under 255 characters.' USING ERRCODE = '22023';
    END IF;
    IF NEW.primary_contact_email <> '' AND NEW.primary_contact_email !~ v_email_re THEN
      RAISE EXCEPTION 'Invalid studio contact email address.' USING ERRCODE = '22023';
    END IF;
    IF NEW.primary_contact_email = '' THEN NEW.primary_contact_email := NULL; END IF;
  END IF;

  IF NEW.primary_contact_phone IS NOT NULL THEN
    NEW.primary_contact_phone := regexp_replace(NEW.primary_contact_phone, '[^0-9+]', '', 'g');
    IF position('+' in NEW.primary_contact_phone) > 0 THEN
      NEW.primary_contact_phone := '+' || regexp_replace(NEW.primary_contact_phone, '[+]', '', 'g');
    END IF;
    IF NEW.primary_contact_phone <> '' AND
       (length(regexp_replace(NEW.primary_contact_phone, '[^0-9]', '', 'g')) < 7
        OR length(regexp_replace(NEW.primary_contact_phone, '[^0-9]', '', 'g')) > 15) THEN
      RAISE EXCEPTION 'Studio contact phone must have 7-15 digits.' USING ERRCODE = '22023';
    END IF;
    IF NEW.primary_contact_phone = '' THEN NEW.primary_contact_phone := NULL; END IF;
  END IF;

  IF NEW.year_founded IS NOT NULL AND (NEW.year_founded < 1800 OR NEW.year_founded > EXTRACT(YEAR FROM now())::int + 1) THEN
    RAISE EXCEPTION 'Year founded is out of range.' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_entity_profile_studio_ext ON public.entity_profile_studio_ext;
CREATE TRIGGER trg_validate_entity_profile_studio_ext
BEFORE INSERT OR UPDATE ON public.entity_profile_studio_ext
FOR EACH ROW
EXECUTE FUNCTION public.validate_entity_profile_studio_ext();
