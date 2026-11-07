-- The platform is operated by the Taiwan Automotive Electronics Association.
-- Keep partner schools as their own role; do not present STUST as the operator.

update public.program_offerings
set school_name = '合作開班學校',
    department_name = '汽修專業人才橋接'
where school_name = 'Southern Taiwan University of Science and Technology';
