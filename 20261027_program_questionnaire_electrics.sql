-- Restore the fifth student pathway: electric vehicles and automotive electronics.
alter table public.program_questionnaire_submissions
  drop constraint if exists program_questionnaire_submissions_questionnaire_type_check;

alter table public.program_questionnaire_submissions
  add constraint program_questionnaire_submissions_questionnaire_type_check
  check (questionnaire_type in ('integrated', 'maintenance', 'sales', 'parts', 'electrics'));
